'use client'
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { rise } from '@/lib/motion'
import { StaggerGroup } from '@/components/glass/Glass'

// API calls go through server-side proxy routes so the secret never hits the browser
const FASTAPI_URL  = '/api/rag'
const CLIENT_ID    = process.env.NEXT_PUBLIC_CLIENT_ID || 'default'

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
    } catch { setDocuments([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchDocuments() }, [])

  function handleDrop(e) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.txt') || file.name.endsWith('.pdf'))) {
      setSelectedFile(file); setUploadError(null)
    } else { setUploadError('Only .txt and .pdf files are accepted.') }
  }

  function handleFileSelect(e) {
    const file = e.target.files[0]
    if (file) { setSelectedFile(file); setUploadError(null) }
  }

  async function handleUpload() {
    if (!selectedFile) return
    setUploading(true); setUploadError(null)
    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('client_id', CLIENT_ID)
    try {
      const res = await fetch(`${FASTAPI_URL}/ingest`, {
        method: 'POST',
        body: formData
      })
      if (!res.ok) throw new Error()
      setSelectedFile(null); await fetchDocuments()
    } catch { setUploadError('Something went wrong — try again.') }
    finally { setUploading(false) }
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
        <h1 className="text-[1.4rem] font-extrabold text-white tracking-tight mb-1">Knowledge Base</h1>
        <p className="text-white/35 text-[12.5px]">Upload documents your bot uses to answer questions. Changes go live within 2 minutes.</p>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all cursor-pointer mb-6 ${
          dragOver
            ? 'border-[#00e5b0]/50 bg-[#00e5b0]/[0.05]'
            : 'border-white/[0.08] hover:border-white/20 bg-white/[0.02]'
        }`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".txt,.pdf" className="hidden" onChange={handleFileSelect} />
        {selectedFile ? (
          <div onClick={e => e.stopPropagation()}>
            <div className="w-11 h-11 bg-[#00e5b0]/10 border border-[#00e5b0]/20 rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5 text-[#00e5b0]">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/>
              </svg>
            </div>
            <p className="text-white font-semibold text-[13.5px]">{selectedFile.name}</p>
            <p className="text-white/30 text-[12px] mt-1">{(selectedFile.size / 1024).toFixed(0)} KB</p>
            <div className="flex items-center justify-center gap-3 mt-5">
              <button onClick={handleUpload} disabled={uploading}
                className="px-6 py-2.5 bg-[#00e5b0] text-[#080808] text-[13px] font-bold rounded-xl hover:brightness-110 disabled:opacity-50 transition-all">
                {uploading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Processing…
                  </span>
                ) : 'Upload & Process'}
              </button>
              <button onClick={() => setSelectedFile(null)} className="px-4 py-2.5 text-white/35 hover:text-white text-[13px] transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="w-11 h-11 bg-white/[0.04] rounded-xl flex items-center justify-center mx-auto mb-3">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="w-5 h-5 text-white/30">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/>
              </svg>
            </div>
            <p className="text-white/45 text-[13px]">Drag & drop a file, or <span className="text-[#00e5b0]">browse</span></p>
            <p className="text-white/20 text-[11.5px] mt-1">Accepts .txt and .pdf</p>
          </>
        )}
      </div>

      {uploadError && (
        <div className="mb-5 px-4 py-3 bg-red-500/[0.08] border border-red-500/20 rounded-xl text-red-400 text-[13px]">{uploadError}</div>
      )}

      {/* Document list */}
      <div>
        <p className="text-[10.5px] font-semibold text-white/20 uppercase tracking-[0.12em] mb-4">Uploaded Documents</p>
        {loading ? (
          <p className="text-white/25 text-[13px]">Loading…</p>
        ) : documents.length === 0 ? (
          <div className="text-center py-14 text-white/15 text-[13px]">No documents uploaded yet.</div>
        ) : (
          <StaggerGroup className="space-y-2">
            {documents.map(doc => (
              <motion.div key={doc.id} variants={rise} className="flex items-center justify-between px-5 py-4 bg-white/[0.03] border border-white/[0.07] backdrop-blur-xl rounded-2xl relative hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 bg-white/[0.04] rounded-xl flex items-center justify-center text-[13px]">
                    {doc.filename?.endsWith('.pdf') ? '📕' : '📄'}
                  </div>
                  <div>
                    <p className="text-white text-[13.5px] font-medium">{doc.filename}</p>
                    <p className="text-white/25 text-[11.5px] mt-0.5">{formatDate(doc.created_at)} · {doc.chunk_count} chunks</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-[11.5px] px-2.5 py-1 rounded-full font-medium ${
                    doc.status === 'active' ? 'bg-[#00e5b0]/10 text-[#00e5b0]' : 'bg-amber-500/10 text-amber-400'
                  }`}>
                    {doc.status === 'active' ? 'Active' : 'Processing'}
                  </span>
                  <button onClick={() => handleDelete(doc.id)} className="text-white/20 hover:text-red-400 transition-colors text-[13px] px-2 py-1 rounded">
                    Delete
                  </button>
                </div>
              </motion.div>
            ))}
          </StaggerGroup>
        )}
      </div>
    </div>
  )
}
