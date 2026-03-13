package com.gif2video.app

import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import com.arthenica.ffmpegkit.FFmpegKit
import com.arthenica.ffmpegkit.ReturnCode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

class MainActivity : AppCompatActivity() {
    private var selectedGifUri: Uri? = null

    private lateinit var selectedFileText: TextView
    private lateinit var statusText: TextView
    private lateinit var fpsInput: EditText
    private lateinit var batchFpsInput: EditText
    private lateinit var pickButton: Button
    private lateinit var convertButton: Button
    private lateinit var batchConvertButton: Button
    private lateinit var progressBar: ProgressBar

    private val pickGifLauncher = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) {
            selectedGifUri = uri
            selectedFileText.text = "已选择: ${getDisplayName(uri)}"
            statusText.text = ""
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        selectedFileText = findViewById(R.id.selectedFileText)
        statusText = findViewById(R.id.statusText)
        fpsInput = findViewById(R.id.fpsInput)
        batchFpsInput = findViewById(R.id.batchFpsInput)
        pickButton = findViewById(R.id.pickButton)
        convertButton = findViewById(R.id.convertButton)
        batchConvertButton = findViewById(R.id.batchConvertButton)
        progressBar = findViewById(R.id.progressBar)

        pickButton.setOnClickListener { pickGifLauncher.launch("image/gif") }
        convertButton.setOnClickListener { convertGif() }
        batchConvertButton.setOnClickListener { convertGifBatch() }
    }

    private fun convertGif() {
        val uri = selectedGifUri
        if (uri == null) {
            showError("请先选择 GIF 文件")
            return
        }

        val fps = fpsInput.text.toString().toIntOrNull()
        if (fps == null || fps !in 1..120) {
            showError("帧率请输入 1-120")
            return
        }

        setBusy(true)
        statusText.text = "转换中..."

        lifecycleScope.launch {
            runCatching {
                convertAndSaveOne(uri, fps)
            }.onSuccess {
                statusText.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.success))
                statusText.text = "保存成功（${if (it) "硬编" else "软编"}）"
                Toast.makeText(this@MainActivity, "保存成功", Toast.LENGTH_SHORT).show()
            }.onFailure { err ->
                showError(err.message ?: "转换失败，请重试")
            }

            setBusy(false)
        }
    }

    private fun convertGifBatch() {
        val uri = selectedGifUri
        if (uri == null) {
            showError("请先选择 GIF 文件")
            return
        }

        val fpsList = batchFpsInput.text.toString()
            .split(",")
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .mapNotNull { it.toIntOrNull() }
            .distinct()
            .filter { it in 1..120 }

        if (fpsList.isEmpty()) {
            showError("批量帧率格式错误，例如：24,30,60")
            return
        }

        setBusy(true)
        statusText.text = "批量转换中..."

        lifecycleScope.launch {
            runCatching {
                var hwCount = 0
                fpsList.forEachIndexed { index, fps ->
                    statusText.text = "批量转换中...(${index + 1}/${fpsList.size}) ${fps}fps"
                    val usedHardware = convertAndSaveOne(uri, fps)
                    if (usedHardware) hwCount++
                }
                hwCount
            }.onSuccess { hwCount ->
                statusText.setTextColor(ContextCompat.getColor(this@MainActivity, R.color.success))
                statusText.text = "批量保存成功（硬编 ${hwCount}/${fpsList.size}）"
                Toast.makeText(this@MainActivity, "批量保存成功", Toast.LENGTH_SHORT).show()
            }.onFailure { err ->
                showError(err.message ?: "批量转换失败，请重试")
            }
            setBusy(false)
        }
    }

    private suspend fun convertAndSaveOne(uri: Uri, fps: Int): Boolean {
        val inputFile = withContext(Dispatchers.IO) { copyUriToTempFile(uri) }
        val baseName = getDisplayName(uri).removeSuffix(".gif")
        val outputName = "${baseName}_${fps}fps_${System.currentTimeMillis()}.mp4"
        val outputFile = File(cacheDir, outputName)

        val usedHardware = withContext(Dispatchers.IO) {
            transcodeGif(inputFile, outputFile, fps)
        }

        withContext(Dispatchers.IO) {
            saveToMovies(outputFile, outputName)
        }

        inputFile.delete()
        outputFile.delete()
        return usedHardware
    }

    private fun transcodeGif(inputFile: File, outputFile: File, fps: Int): Boolean {
        val commonArgs = listOf(
            "-y",
            "-i", inputFile.absolutePath,
            "-vf", "fps=$fps,scale=trunc(iw/2)*2:trunc(ih/2)*2",
            "-movflags", "faststart"
        )

        // 先尝试 MediaCodec 硬件编码，失败自动回退到软件编码，兼顾性能和兼容性。
        val hwCommand = (commonArgs + listOf(
            "-c:v", "h264_mediacodec",
            "-b:v", "4M",
            "-pix_fmt", "yuv420p",
            outputFile.absolutePath
        )).joinToString(" ") { quote(it) }

        val hwSession = FFmpegKit.execute(hwCommand)
        if (ReturnCode.isSuccess(hwSession.returnCode)) {
            return true
        }

        val swCommand = (commonArgs + listOf(
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "23",
            "-pix_fmt", "yuv420p",
            outputFile.absolutePath
        )).joinToString(" ") { quote(it) }

        val swSession = FFmpegKit.execute(swCommand)
        if (!ReturnCode.isSuccess(swSession.returnCode)) {
            throw IllegalStateException("转换失败: ${swSession.allLogsAsString.takeLast(300)}")
        }
        return false
    }

    private fun setBusy(isBusy: Boolean) {
        progressBar.visibility = if (isBusy) View.VISIBLE else View.GONE
        pickButton.isEnabled = !isBusy
        convertButton.isEnabled = !isBusy
        batchConvertButton.isEnabled = !isBusy
        fpsInput.isEnabled = !isBusy
        batchFpsInput.isEnabled = !isBusy
    }

    private fun showError(message: String) {
        statusText.setTextColor(ContextCompat.getColor(this, android.R.color.holo_red_light))
        statusText.text = message
        Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    }

    private fun getDisplayName(uri: Uri): String {
        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (index >= 0 && cursor.moveToFirst()) {
                return cursor.getString(index) ?: "input.gif"
            }
        }
        return "input.gif"
    }

    private fun copyUriToTempFile(uri: Uri): File {
        val temp = File(cacheDir, "input_${System.currentTimeMillis()}.gif")
        contentResolver.openInputStream(uri)?.use { input ->
            temp.outputStream().use { output -> input.copyTo(output) }
        } ?: throw IllegalStateException("无法读取选择的文件")
        return temp
    }

    private fun saveToMovies(source: File, displayName: String) {
        val resolver = contentResolver
        val values = android.content.ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, displayName)
            put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
            put(MediaStore.Video.Media.RELATIVE_PATH, "${Environment.DIRECTORY_MOVIES}/GIF转视频")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                put(MediaStore.Video.Media.IS_PENDING, 1)
            }
        }

        val collection = MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
        val item = resolver.insert(collection, values)
            ?: throw IllegalStateException("保存失败：无法创建媒体文件")

        resolver.openOutputStream(item)?.use { out ->
            source.inputStream().use { it.copyTo(out) }
        } ?: throw IllegalStateException("保存失败：无法写入媒体文件")

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            values.clear()
            values.put(MediaStore.Video.Media.IS_PENDING, 0)
            resolver.update(item, values, null, null)
        }
    }

    private fun quote(arg: String): String = "'${arg.replace("'", "'\\''")}'"
}

