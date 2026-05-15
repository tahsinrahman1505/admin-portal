'use client'
import { useState, useEffect, useRef } from 'react'

const FASTAPI_URL = process.env.NEXT_PUBLIC_FASTAPI_URL || 'http://127.0.0.1:8000'
const CLIENT_ID = process.env.NEXT_PUBLIC_CLIENT_ID || 'default'

export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const fileInputRef = useRef(null)

  async function fetchDocuments() {
    try {
      const res = await fetch(`${FASTAPI_URL}/ingest/list?client_id=${CLIENT_ID}`)
      const data = await res.json()
      setDocuments(data.documents || [])
    } catch {
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchDocuments() }, [])

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.txt') || file.name.endsWith('.pdf'))) {
      setSelectedFile(file)
      setUploadError(null)
    } else {
      setUploadError('Only .txt and .pdf files are accepted.')
    }
  }

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (file) { setSelectedFile(file); setUploadError(null) }
  }

  async function handleUpload() {
    if (!selectedFile) return
    setUploading(true)
    setUploadError(null)
    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('client_id', CLIENT_ID)
    try {
      const res = await fetch(`${FASTAPI_URL}/ingest`, { method: 'POST', body: formData })
      if (!res.ok) throw new Error()
      setSelectedFile(null)
      await fetchDocuments()
    } catch {
      setUploadError('Something went wrong — try again.')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(docId) {
    if (!confirm('Delete this document and all its chunks?')) return
    await fetch(`${FASTAPI_URL}/ingest/${docId}`, { method: 'DELETE' })
    setDocuments(prev => prev.filter(d => d.id !== docId))
  }

  function formatDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white mb-1">Knowledge Base</h1>
        <p className="text-white/40 text-sm">Upload documents your bot uses to answer questions. Changes go live within 2 minutes.</p>
      </div>
      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer mb-8 ${dragOver ? 'border-blue-400 bg-blue-500/10' : 'border-white/10 hover:border-white/25 bg-white/[0.02]'}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".txt,.pdf" className="hidden" onChange={handleFileSelect} />
        {selectedFile ? (
          <div onClick={e => e.stopPropagation()}>
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
              <span className="text-blue-400 text-lg">📄</span>
            </div>
            <p className="text-white font-medium">{selectedFile.name}</p>
            <p className="text-white/40 text-sm mt-1">{(selectedFile.size / 1024).toFixed(0)} KB</p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <button onClick={handleUpload} disabled={uploading} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Processing your document...
                  </span>
                ) : 'Upload & Process'}
              </button>
              <button onClick={() => setSelectedFile(null)} className="px-4 py-2.5 text-white/40 hover:text-white text-sm transition-colors">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center mx-auto mb-3">
              <span className="text-white/40 text-xl">↑</span>
            </div>
            <p className="text-white/60 text-sm">Drag & drop a file here, or <span className="text-blue-400">browse</span></p>
            <p className="text-white/25 text-xs mt-1">Accepts .txt and .pdf</p>
          </>
        )}
      </div>
      {uploadError && (
        <div className="mb-6 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">{uploadError}</div>
      )}
      <div>
        <h2 className="text-white/50 text-xs font-medium uppercase tracking-widest mb-4">Uploaded Documents</h2>
        {loading ? (
          <p className="text-white/30 text-sm">Loading...</p>
        ) : documents.length === 0 ? (
          <div className="text-center py-12 text-white/20 text-sm">No documents uploaded yet.</div>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between px-5 py-4 bg-white/[0.03] border border-white/[0.06] rounded-xl hover:bg-white/[0.05] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center text-sm">
                    {doc.filename?.endsWith('.pdf') ? '📕' : '📄'}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{doc.filename}</p>
                    <p className="text-white/30 text-xs mt-0.5">{formatDate(doc.created_at)} · {doc.chunk_count} chunks</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${doc.status === 'active' ? 'bg-green-500/15 text-green-400' : 'bg-amber-500/15 text-amber-400'}`}>
                    {doc.status === 'active' ? 'Active' : 'Processing'}
                  </span>
                  <button onClick={() => handleDelete(doc.id)} className="text-white/20 hover:text-red-400 transition-colors text-sm px-2 py-1 rounded">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
