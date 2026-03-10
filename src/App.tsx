import { useState, useCallback } from 'react'
import { convertGifToVideo } from './utils/gifToVideo'
import { saveVideoBlob } from './utils/saveFile'
import './App.css'

function App() {
  const [gifFile, setGifFile] = useState<File | null>(null)
  const [frameRate, setFrameRate] = useState(24)
  const [status, setStatus] = useState<'idle' | 'loading' | 'converting' | 'done' | 'error'>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'image/gif') {
      setGifFile(file)
      setStatus('idle')
      setErrorMsg('')
    } else if (file) {
      setErrorMsg('请选择 GIF 格式的文件')
      setGifFile(null)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'image/gif') {
      setGifFile(file)
      setStatus('idle')
      setErrorMsg('')
    } else if (file) {
      setErrorMsg('请选择 GIF 格式的文件')
      setGifFile(null)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleConvert = useCallback(async () => {
    if (!gifFile) return

    setStatus('loading')
    setProgress(0)
    setErrorMsg('')

    try {
      setStatus('converting')
      const blob = await convertGifToVideo({
        gifFile,
        frameRate,
        onProgress: setProgress,
      })

      const baseName = gifFile.name.replace(/\.gif$/i, '')
      const filename = `${baseName}_${frameRate}fps_${Date.now()}.mp4`
      await saveVideoBlob(blob, filename)

      setStatus('done')
    } catch (err) {
      setStatus('error')
      const msg = err instanceof Error ? err.message : String(err)
      setErrorMsg(msg || '转换失败，请重试')
      console.error('GIF转视频失败:', err)
    }
  }, [gifFile, frameRate])

  const handleReset = useCallback(() => {
    setGifFile(null)
    setStatus('idle')
    setProgress(0)
    setErrorMsg('')
  }, [])

  return (
    <div className="app">
      <header className="header">
        <h1>GIF → 视频</h1>
        <p className="subtitle">支持自定义导出帧率，输出 MP4 格式</p>
      </header>

      <main className="main">
        <section className="upload-section">
          <div
            className={`dropzone ${gifFile ? 'has-file' : ''} ${errorMsg ? 'error' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <input
              id="file-input"
              type="file"
              accept="image/gif"
              onChange={handleFileChange}
              hidden
            />
            {gifFile ? (
              <div className="file-info">
                <span className="file-icon">📄</span>
                <span className="file-name">{gifFile.name}</span>
                <span className="file-size">
                  ({(gifFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            ) : (
              <div className="dropzone-placeholder">
                <span className="dropzone-icon">📤</span>
                <span>点击选择 GIF 文件</span>
              </div>
            )}
          </div>
          {errorMsg && <p className="error-msg">{errorMsg}</p>}
        </section>

        <section className="settings-section">
          <label className="setting-row">
            <span className="label">导出帧率 (fps)</span>
            <div className="frame-rate-control">
              <input
                type="range"
                min="1"
                max="60"
                value={frameRate}
                onChange={(e) => setFrameRate(Number(e.target.value))}
                className="slider"
              />
              <input
                type="number"
                min="1"
                max="120"
                value={frameRate}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (v >= 1 && v <= 120) setFrameRate(v)
                }}
                className="frame-rate-input"
              />
            </div>
          </label>
          <p className="hint">常用：24 fps（电影）、30 fps（流畅）、60 fps（高帧率）</p>
        </section>

        <section className="action-section">
          {(status === 'loading' || status === 'converting') && (
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${progress}%` }}
              />
              <span className="progress-text">
                {status === 'loading' ? '加载 FFmpeg...' : `转换中 ${progress}%`}
              </span>
            </div>
          )}

          <div className="buttons">
            <button
              className="btn btn-primary"
              onClick={handleConvert}
              disabled={!gifFile || status === 'loading' || status === 'converting'}
            >
              {status === 'loading' || status === 'converting'
                ? '处理中...'
                : '转换为 MP4'}
            </button>
            <button
              className="btn btn-secondary"
              onClick={handleReset}
              disabled={status === 'loading' || status === 'converting'}
            >
              重置
            </button>
          </div>
        </section>

        {status === 'done' && (
          <p className="success-msg">✓ 保存成功</p>
        )}
      </main>

      <footer className="footer">
        <p>基于 FFmpeg.wasm · 转换在浏览器本地完成，不上传服务器</p>
      </footer>
    </div>
  )
}

export default App
