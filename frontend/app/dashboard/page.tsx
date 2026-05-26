"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const BASE = "http://localhost:8000";

export default function Dashboard() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [resumeId, setResumeId] = useState("");
  const [resumeName, setResumeName] = useState("");
  const [jdText, setJdText] = useState("");
  const [score, setScore] = useState<number | null>(null);
  const [topChunks, setTopChunks] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const [error, setError] = useState("");
  const [bulletInput, setBulletInput] = useState("");
  const [rewrittenBullet, setRewrittenBullet] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const rewriteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
  const token = localStorage.getItem("token");
  if (!token) router.push("/auth");
  else fetchHistory();
}, []);

  function logout() {
    localStorage.removeItem("token");
    router.push("/auth");
  }
  async function fetchHistory() {
  setLoadingHistory(true);
  try {
    const res = await fetch(`${BASE}/analyze/history`);
    const data = await res.json();
    setHistory(data);
  } catch (e) {
    console.error("Could not load history");
  }
  setLoadingHistory(false);
}
  async function uploadResume() {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE}/resume/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.id) {
        setResumeId(data.id);
        setResumeName(data.filename || file.name);
        setUploadDone(true);
      } else {
        setError(data.detail || "Upload failed");
      }
    } catch (e) {
      setError("Could not connect to server");
    }
    setUploading(false);
  }

  async function analyze() {
    if (!resumeId || !jdText.trim()) return;
    setAnalyzing(true);
    setError("");
    setScore(null);
    try {
      const res = await fetch(`${BASE}/analyze/match`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resume_id: resumeId, jd_text: jdText }),
      });
      const data = await res.json();
      if (data.score !== undefined) {
        setScore(data.score);
        setTopChunks(data.top_chunks || []);
        fetchHistory();
        setMatchedKeywords(data.matched_keywords || []);
        setMissingKeywords(data.missing_keywords || []);
        setFromCache(data.from_cache || false);
      } else {
        setError(data.detail || "Analysis failed");
      }
    } catch (e) {
      setError("Could not connect to server");
    }
    setAnalyzing(false);
  }

  async function rewriteBullet() {
    if (!bulletInput.trim() || !jdText.trim()) return;
    setRewriting(true);
    setRewrittenBullet("");
    setError("");
    try {
      const res = await fetch(`${BASE}/analyze/rewrite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bullet: bulletInput, jd_text: jdText }),
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        setRewrittenBullet(prev => prev + chunk);
        // Auto scroll
        if (rewriteRef.current) {
          rewriteRef.current.scrollTop = rewriteRef.current.scrollHeight;
        }
      }
    } catch (e) {
      setError("Could not connect to Ollama. Make sure it is running.");
    }
    setRewriting(false);
  }

  function getScoreColor(s: number) {
    if (s >= 70) return "text-green-600";
    if (s >= 50) return "text-yellow-600";
    return "text-red-500";
  }

  function getScoreLabel(s: number) {
    if (s >= 70) return "Strong Match ✅";
    if (s >= 50) return "Moderate Match ⚠️";
    return "Weak Match ❌";
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-200 px-8 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-900">ResumeRadar</h1>
        <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-900">
          Logout
        </button>
      </nav>

      <div className="max-w-5xl mx-auto p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-1">Analyze your resume</h2>
          <p className="text-gray-400 text-sm">Upload your resume and paste a job description to get your match score.</p>
        </div>

        {/* Upload + JD */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Resume Upload */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">① Upload Resume</h3>
            {!uploadDone ? (
              <>
                <label className="block w-full border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition-all">
                  <input
                    type="file"
                    accept=".pdf,.txt"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  {file ? (
                    <div>
                      <p className="text-gray-900 font-medium">{file.name}</p>
                      <p className="text-gray-400 text-sm mt-1">Click to change</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-3xl mb-2">📄</p>
                      <p className="text-gray-500 text-sm">Click to upload PDF or TXT</p>
                    </div>
                  )}
                </label>
                <button
                  onClick={uploadResume}
                  disabled={!file || uploading}
                  className="mt-4 w-full bg-gray-900 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-700 transition-all disabled:opacity-40"
                >
                  {uploading ? "Uploading..." : "Upload Resume"}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="text-green-800 font-medium text-sm">{resumeName}</p>
                  <p className="text-green-600 text-xs mt-0.5">Ready to analyze</p>
                </div>
                <button
                  onClick={() => { setUploadDone(false); setFile(null); setScore(null); setRewrittenBullet(""); }}
                  className="ml-auto text-xs text-gray-400 hover:text-gray-600"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* JD Input */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">② Paste Job Description</h3>
            <textarea
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the full job description here..."
              className="w-full h-48 border border-gray-200 rounded-xl p-3 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            <p className="text-xs text-gray-400 mt-1">{jdText.length} characters</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Analyze Button */}
        <button
          onClick={analyze}
          disabled={!uploadDone || !jdText.trim() || analyzing}
          className="w-full bg-gray-900 text-white rounded-xl py-3 text-sm font-medium hover:bg-gray-700 transition-all disabled:opacity-40"
        >
          {analyzing ? "Analyzing with AI..." : "③ Analyze Match"}
        </button>

        {/* Score Result */}
        {score !== null && (
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <div className="text-center mb-8">
              <p className="text-gray-400 text-sm mb-2">
               Match Score
                {fromCache && (
              <span className="ml-2 text-xs bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">
            ⚡ cached
            </span>
            )}
          </p>
              <p className={`text-7xl font-bold ${getScoreColor(score)}`}>
                {score}%
              </p>
              <p className={`text-lg font-medium mt-2 ${getScoreColor(score)}`}>
                {getScoreLabel(score)}
              </p>
            </div>
        {/* Skills Gap */}
        {(matchedKeywords.length > 0 || missingKeywords.length > 0) && (
          <div className="mb-8">
            <h4 className="font-semibold text-gray-900 mb-4 text-sm">
          Skills Gap Analysis
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Matched */}
      {matchedKeywords.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-700 mb-3 flex items-center gap-1">
            ✅ Found in your resume
            <span className="ml-auto bg-green-100 text-green-700 rounded-full px-2 py-0.5 text-xs">
              {matchedKeywords.length}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {matchedKeywords.map((kw) => (
              <span
                key={kw}
                className="bg-green-100 text-green-800 border border-green-200 text-xs px-3 py-1 rounded-full font-medium"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Missing */}
      {missingKeywords.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-red-700 mb-3 flex items-center gap-1">
            ❌ Missing from your resume
            <span className="ml-auto bg-red-100 text-red-700 rounded-full px-2 py-0.5 text-xs">
              {missingKeywords.length}
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            {missingKeywords.map((kw) => (
              <span
                key={kw}
                className="bg-red-100 text-red-800 border border-red-200 text-xs px-3 py-1 rounded-full font-medium"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  </div>
)}

            {topChunks.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-900 mb-3 text-sm">
                  Most relevant sections from your resume:
                </h4>
                <div className="space-y-3">
                  {topChunks.map((chunk, i) => (
                    <div key={i} className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 leading-relaxed">
                      {chunk}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Bullet Rewriter */}
        {score !== null && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-1">✨ AI Bullet Rewriter</h3>
            <p className="text-gray-400 text-sm mb-4">
              Paste any resume bullet and Mistral will rewrite it to better match the job description.
            </p>

            <textarea
              value={bulletInput}
              onChange={(e) => setBulletInput(e.target.value)}
              placeholder="e.g. Built a web app using React and Node.js"
              className="w-full h-24 border border-gray-200 rounded-xl p-3 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 mb-3"
            />

            <button
              onClick={rewriteBullet}
              disabled={!bulletInput.trim() || !jdText.trim() || rewriting}
              className="w-full bg-indigo-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-indigo-500 transition-all disabled:opacity-40 mb-4"
            >
              {rewriting ? "Rewriting..." : "Rewrite with Mistral ✨"}
            </button>

            {rewrittenBullet && (
              <div
                ref={rewriteRef}
                className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-gray-900 leading-relaxed min-h-16"
              >
                <p className="text-xs text-indigo-400 mb-2 font-medium">REWRITTEN BULLET</p>
                {rewrittenBullet}
                {rewriting && <span className="animate-pulse">▊</span>}
              </div>
            )}
          </div>
        )}
        {/* Analysis History */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-900 mb-1">📋 Past Analyses</h3>
          <p className="text-gray-400 text-sm mb-4">Your previous match results</p>

          {loadingHistory ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-400">No analyses yet — run your first match above!</p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {item.resume_name}
                      </span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-400">
                        {item.created_at
                          ? new Date(item.created_at).toLocaleDateString("en-US", {
                              month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
                            })
                          : ""}
                      </span>
                    </div>
                    <span className={`text-lg font-bold ${
                      item.score >= 70 ? "text-green-600" :
                      item.score >= 50 ? "text-yellow-600" : "text-red-500"
                    }`}>
                      {item.score}%
                    </span>
                  </div>

                  <p className="text-xs text-gray-400 mb-3 line-clamp-1">
                    {item.jd_preview}
                  </p>

                  <div className="flex flex-wrap gap-1">
                    {item.matched_keywords?.slice(0, 4).map((kw: string) => (
                      <span key={kw} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">
                        {kw}
                      </span>
                    ))}
                    {item.missing_keywords?.slice(0, 4).map((kw: string) => (
                      <span key={kw} className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                        {kw}
                      </span>
                    ))}
                    {((item.matched_keywords?.length || 0) + (item.missing_keywords?.length || 0)) > 8 && (
                      <span className="text-xs text-gray-400 px-2 py-0.5">
                        +{(item.matched_keywords?.length || 0) + (item.missing_keywords?.length || 0) - 8} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}