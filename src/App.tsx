import React, { useState, useEffect } from 'react';
import { Download, Link as LinkIcon, FileText, Globe, Image as ImageIcon, Loader2, AlertCircle, CheckCircle2, FileCode, Type, Copy, ExternalLink, ChevronRight, History, X, Sun, Moon, Settings, LayoutGrid, List } from 'lucide-react';
import TurndownService from 'turndown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const turndownService = new TurndownService();

interface ContentInfo {
  url: string;
  contentType: string;
  data: any;
  title?: string;
  preview?: string;
}

interface QueueItem {
  id: string;
  url: string;
  title: string;
  format: 'html' | 'md' | 'txt' | 'raw' | 'png' | 'jpg' | 'webp';
  status: 'pending' | 'downloading' | 'completed' | 'error';
  progress: number;
  error?: string;
}

export default function App() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentInfo, setContentInfo] = useState<ContentInfo | null>(null);
  const [recentUrls, setRecentUrls] = useState<string[]>([]);
  const [useFileSystemApi, setUseFileSystemApi] = useState(false);
  const [isFsSupported, setIsFsSupported] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ percent: number, filename: string } | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('recent_urls');
    if (saved) setRecentUrls(JSON.parse(saved));
    
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setDarkMode(true);
    }
    
    // Check if File System Access API is supported
    const supported = 'showSaveFilePicker' in window;
    setIsFsSupported(supported);
    // Enable by default if supported
    if (supported) setUseFileSystemApi(true);
  }, []);

  const saveRecentUrl = (newUrl: string) => {
    const updated = [newUrl, ...recentUrls.filter(u => u !== newUrl)].slice(0, 5);
    setRecentUrls(updated);
    localStorage.setItem('recent_urls', JSON.stringify(updated));
  };

  const isValidUrl = (urlString: string) => {
    try {
      const urlObj = new URL(urlString);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch (e) {
      return false;
    }
  };

  const analyzeUrl = async (e?: React.FormEvent, targetUrl?: string) => {
    if (e) e.preventDefault();
    const finalUrl = targetUrl || url;
    if (!finalUrl) return;

    if (!isValidUrl(finalUrl)) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }

    setLoading(true);
    setError(null);
    setContentInfo(null);

    try {
      const response = await fetch('/api/fetch-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: finalUrl }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to analyze URL');
      }

      // Extract title and preview if it's HTML
      let title = 'downloaded-content';
      let preview = '';
      if (result.contentType?.includes('text/html')) {
        const doc = new DOMParser().parseFromString(result.data, 'text/html');
        title = doc.title || 'webpage';
        // Get first 200 chars of text
        preview = doc.body.innerText?.slice(0, 300).replace(/\s+/g, ' ').trim() + '...';
      } else {
        const urlParts = finalUrl.split('/');
        const lastPart = urlParts[urlParts.length - 1];
        if (lastPart && lastPart.includes('.')) {
          title = lastPart.split('.')[0];
        }
      }

      setContentInfo({ ...result, title, preview });
      saveRecentUrl(finalUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isProcessingQueue && queue.some(item => item.status === 'pending')) {
      processNextInQueue();
    }
  }, [queue, isProcessingQueue]);

  const processNextInQueue = async () => {
    const nextItem = queue.find(item => item.status === 'pending');
    if (!nextItem) return;

    setIsProcessingQueue(true);
    updateQueueItem(nextItem.id, { status: 'downloading' });

    try {
      await executeDownload(nextItem.url, nextItem.title, nextItem.format, (progress) => {
        updateQueueItem(nextItem.id, { progress });
      });
      updateQueueItem(nextItem.id, { status: 'completed', progress: 100 });
    } catch (err: any) {
      updateQueueItem(nextItem.id, { status: 'error', error: err.message });
    } finally {
      setIsProcessingQueue(false);
    }
  };

  const updateQueueItem = (id: string, updates: Partial<QueueItem>) => {
    setQueue(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const addToQueue = (format: 'html' | 'md' | 'txt' | 'raw' | 'png' | 'jpg' | 'webp') => {
    if (!contentInfo) return;
    const newItem: QueueItem = {
      id: Math.random().toString(36).substr(2, 9),
      url: contentInfo.url,
      title: contentInfo.title || 'content',
      format,
      status: 'pending',
      progress: 0
    };
    setQueue(prev => [...prev, newItem]);
  };

  const removeFromQueue = (id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  };

  const clearCompleted = () => {
    setQueue(prev => prev.filter(item => item.status !== 'completed'));
  };

  const downloadFile = async (content: string | Blob, filename: string, mimeType: string) => {
    try {
      const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
      
      // Try File System Access API if supported and requested
      if (useFileSystemApi && 'showSaveFilePicker' in window) {
        try {
          const handle = await (window as any).showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: 'File',
              accept: { [mimeType]: [`.${filename.split('.').pop()}`] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
          return;
        } catch (err: any) {
          // If user cancels, don't fallback, just stop
          if (err.name === 'AbortError') return;
          console.warn("File System API failed, falling back to standard download", err);
        }
      }

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (err: any) {
      console.error("Download error:", err);
      setError(`Failed to generate download: ${err.message}`);
    }
  };

  const executeDownload = async (targetUrl: string, title: string, format: string, onProgress?: (p: number) => void) => {
    const safeTitle = title.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'content';

    if (['png', 'jpg', 'webp'].includes(format)) {
      const proxyUrl = `/api/proxy-download?url=${encodeURIComponent(targetUrl)}`;
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("Failed to load image for conversion"));
        img.src = proxyUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error("Could not initialize canvas context");
      
      ctx.drawImage(img, 0, 0);
      
      const mimeType = format === 'jpg' ? 'image/jpeg' : `image/${format}`;
      const extension = format === 'jpg' ? 'jpg' : format;
      
      return new Promise<void>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            downloadFile(blob, `${safeTitle}.${extension}`, mimeType).then(resolve).catch(reject);
          } else {
            reject(new Error("Failed to convert image"));
          }
        }, mimeType, 0.9);
      });
    }

    switch (format) {
      case 'html':
        // We need the data. If it's in the queue, we might need to fetch it again if it's not the current contentInfo
        // For simplicity, let's assume we fetch it if it's not current
        let htmlData = contentInfo?.url === targetUrl ? contentInfo.data : null;
        if (!htmlData) {
          const res = await fetch('/api/fetch-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targetUrl }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || 'Failed to fetch content');
          htmlData = result.data;
        }
        await downloadFile(htmlData, `${safeTitle}.html`, 'text/html');
        break;
      case 'md':
        let mdData = contentInfo?.url === targetUrl ? contentInfo.data : null;
        if (!mdData) {
          const res = await fetch('/api/fetch-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targetUrl }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || 'Failed to fetch content');
          mdData = result.data;
        }
        const markdown = turndownService.turndown(mdData);
        await downloadFile(markdown, `${safeTitle}.md`, 'text/markdown');
        break;
      case 'txt':
        let txtData = contentInfo?.url === targetUrl ? contentInfo.data : null;
        if (!txtData) {
          const res = await fetch('/api/fetch-content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targetUrl }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error || 'Failed to fetch content');
          txtData = result.data;
        }
        const doc = new DOMParser().parseFromString(txtData, 'text/html');
        const text = doc.body.innerText || doc.body.textContent || '';
        await downloadFile(text, `${safeTitle}.txt`, 'text/plain');
        break;
      case 'raw':
        const response = await axios.get(`/api/proxy-download`, {
          params: { url: targetUrl },
          responseType: 'blob',
          onDownloadProgress: (progressEvent) => {
            if (progressEvent.total && onProgress) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              onProgress(percent);
            }
          }
        });
        const contentType = response.headers['content-type'] || 'application/octet-stream';
        const extension = contentType.split('/')[1]?.split(';')[0] || 'bin';
        await downloadFile(response.data, `${safeTitle}.${extension}`, contentType);
        break;
    }
  };

  const handleDownload = async (format: 'html' | 'md' | 'txt' | 'raw' | 'png' | 'jpg' | 'webp') => {
    if (!contentInfo) return;
    
    // If it's a raw download or image conversion, it might take time, so we show progress
    // But for simplicity, we can just use the queue for everything if we want
    // Let's keep direct download for now but add a "Queue" option
    
    try {
      if (format === 'raw') {
        setDownloadProgress({ percent: 0, filename: contentInfo.title || 'file' });
        await executeDownload(contentInfo.url, contentInfo.title || 'file', 'raw', (percent) => {
          setDownloadProgress({ percent, filename: contentInfo.title || 'file' });
        });
        setDownloadProgress(null);
      } else {
        await executeDownload(contentInfo.url, contentInfo.title || 'file', format);
      }
    } catch (err: any) {
      setError(`Download failed: ${err.message}`);
      setDownloadProgress(null);
    }
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  const isWebpage = contentInfo?.contentType?.includes('text/html');
  const isImage = contentInfo?.contentType?.includes('image/');

  return (
    <div className={cn(
      "min-h-screen font-sans selection:bg-emerald-100 transition-colors duration-300",
      darkMode ? "bg-zinc-950 text-zinc-100 dark" : "bg-[#FAFAFA] text-[#18181B]"
    )}>
      {/* Header */}
      <header className={cn(
        "border-b sticky top-0 z-50 transition-colors duration-300",
        darkMode ? "bg-zinc-900/80 border-zinc-800 backdrop-blur-xl" : "border-zinc-200 bg-white/80 backdrop-blur-xl"
      )}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <motion.div 
              whileHover={{ rotate: 180 }}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shadow-lg transition-colors",
                darkMode ? "bg-emerald-500 text-zinc-950 shadow-emerald-500/10" : "bg-zinc-900 text-white shadow-zinc-200"
              )}
            >
              <Download size={20} />
            </motion.div>
            <h1 className="font-bold text-xl tracking-tight">
              Universal <span className={darkMode ? "text-emerald-400" : "text-emerald-600"}>Downloader</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={toggleDarkMode}
              className={cn(
                "p-2.5 rounded-xl transition-all border",
                darkMode 
                  ? "bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-emerald-400 hover:border-emerald-400/50" 
                  : "bg-white border-zinc-200 text-zinc-500 hover:text-emerald-600 hover:border-emerald-200"
              )}
            >
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="hidden sm:block h-4 w-[1px] bg-zinc-200 dark:bg-zinc-800 mx-1" />
            <div className="hidden sm:block text-[10px] font-mono text-zinc-400 uppercase tracking-[0.2em]">
              Status: <span className="text-emerald-500">Optimal</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 space-y-12">
        {/* Download Progress Overlay */}
        <AnimatePresence>
          {downloadProgress && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md px-6"
            >
              <div className={cn(
                "rounded-3xl p-6 shadow-2xl border space-y-4",
                darkMode ? "bg-zinc-900 text-white border-zinc-800" : "bg-zinc-900 text-white border-white/10"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                      <Download size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-bold truncate max-w-[200px]">{downloadProgress.filename}</div>
                      <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Downloading...</div>
                    </div>
                  </div>
                  <div className="text-xl font-black text-emerald-500">{downloadProgress.percent}%</div>
                </div>
                <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${downloadProgress.percent}%` }}
                    className="h-full bg-emerald-500"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hero Section */}
        <section className="space-y-6 text-center max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h2 className={cn(
              "text-6xl font-black tracking-tight leading-[1.05]",
              darkMode ? "text-white" : "text-zinc-900"
            )}>
              Web content, <span className="italic font-serif text-emerald-500">liberated</span>.
            </h2>
            <p className={cn(
              "mt-6 text-lg leading-relaxed max-w-2xl mx-auto",
              darkMode ? "text-zinc-400" : "text-zinc-500"
            )}>
              Analyze any public URL and download its contents in the format you need. 
              Clean, fast, and CORS-compliant extraction for the modern web.
            </p>
          </motion.div>
        </section>

        {/* Main Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Input & History */}
          <div className="lg:col-span-8 space-y-8">
            <section className={cn(
              "p-2 rounded-[2.5rem] shadow-2xl transition-all duration-300 border",
              darkMode 
                ? "bg-zinc-900 border-zinc-800 shadow-emerald-950/20" 
                : "bg-white border-zinc-100 shadow-zinc-200/50"
            )}>
              <form onSubmit={analyzeUrl} className="relative flex items-center">
                <div className="absolute left-6 text-zinc-400">
                  <LinkIcon size={22} />
                </div>
                <input
                  type="url"
                  placeholder="Paste a public URL here..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className={cn(
                    "w-full bg-transparent py-7 pl-16 pr-40 focus:outline-none text-xl font-medium placeholder:text-zinc-400",
                    darkMode ? "text-white" : "text-zinc-900"
                  )}
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className={cn(
                    "absolute right-3 px-10 py-4 rounded-[1.5rem] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-xl",
                    darkMode 
                      ? "bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-emerald-500/20" 
                      : "bg-zinc-900 hover:bg-zinc-800 text-white shadow-zinc-300"
                  )}
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : 'Analyze'}
                </button>
              </form>
            </section>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className={cn(
                    "rounded-2xl p-5 flex items-start gap-4 overflow-hidden border",
                    darkMode 
                      ? "bg-red-500/10 border-red-500/20 text-red-400" 
                      : "bg-red-50 border-red-100 text-red-700"
                  )}
                >
                  <AlertCircle className="shrink-0 mt-0.5" size={20} />
                  <p className="text-sm font-semibold leading-relaxed">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Content Display */}
            <AnimatePresence>
              {contentInfo && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div className={cn(
                    "rounded-[2.5rem] p-10 shadow-sm space-y-10 border",
                    darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
                  )}>
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
                      <div className="space-y-3 flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-[11px] font-black text-emerald-500 uppercase tracking-[0.2em]">
                          <CheckCircle2 size={16} />
                          Analysis Complete
                        </div>
                        <h3 className={cn(
                          "text-4xl font-black tracking-tight truncate",
                          darkMode ? "text-white" : "text-zinc-900"
                        )}>
                          {contentInfo.title}
                        </h3>
                        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => window.open(contentInfo.url, '_blank')}>
                          <p className={cn(
                            "text-sm font-semibold truncate max-w-md transition-colors",
                            darkMode ? "text-zinc-500 group-hover:text-emerald-400" : "text-zinc-400 group-hover:text-emerald-600"
                          )}>
                            {contentInfo.url}
                          </p>
                          <ExternalLink size={16} className={cn(
                            "transition-colors",
                            darkMode ? "text-zinc-700 group-hover:text-emerald-400" : "text-zinc-300 group-hover:text-emerald-600"
                          )} />
                        </div>
                      </div>
                      <div className={cn(
                        "px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-[0.15em] whitespace-nowrap self-start border",
                        darkMode 
                          ? "bg-zinc-800 border-zinc-700 text-zinc-400" 
                          : "bg-zinc-50 border-zinc-100 text-zinc-500"
                      )}>
                        {contentInfo.contentType.split(';')[0]}
                      </div>
                    </div>

                    {contentInfo.preview && (
                      <div className={cn(
                        "p-8 rounded-3xl relative overflow-hidden border",
                        darkMode ? "bg-zinc-800/50 border-zinc-700" : "bg-zinc-50 border-zinc-100"
                      )}>
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
                        <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-400 mb-4">Content Preview</h4>
                        <p className={cn(
                          "text-base leading-relaxed italic font-medium",
                          darkMode ? "text-zinc-300" : "text-zinc-600"
                        )}>
                          "{contentInfo.preview}"
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      {isWebpage ? (
                        <>
                          <DownloadCard
                            icon={<FileCode className="text-blue-500" />}
                            title="HTML Source"
                            format="HTML"
                            description="Full webpage structure"
                            onClick={() => handleDownload('html')}
                            onQueue={() => addToQueue('html')}
                            darkMode={darkMode}
                          />
                          <DownloadCard
                            icon={<FileText className="text-orange-500" />}
                            title="Markdown"
                            format="MD"
                            description="Clean documentation format"
                            onClick={() => handleDownload('md')}
                            onQueue={() => addToQueue('md')}
                            darkMode={darkMode}
                          />
                          <DownloadCard
                            icon={<Type className="text-emerald-500" />}
                            title="Plain Text"
                            format="TXT"
                            description="Raw text without tags"
                            onClick={() => handleDownload('txt')}
                            onQueue={() => addToQueue('txt')}
                            darkMode={darkMode}
                          />
                          <DownloadCard
                            icon={<Globe className="text-zinc-500" />}
                            title="Original File"
                            format="RAW"
                            description="Direct server response"
                            onClick={() => handleDownload('raw')}
                            onQueue={() => addToQueue('raw')}
                            darkMode={darkMode}
                          />
                        </>
                      ) : isImage ? (
                        <>
                          <DownloadCard
                            icon={<ImageIcon className="text-purple-500" />}
                            title="Convert to PNG"
                            format="PNG"
                            description="Lossless image format"
                            onClick={() => handleDownload('png')}
                            onQueue={() => addToQueue('png')}
                            darkMode={darkMode}
                          />
                          <DownloadCard
                            icon={<ImageIcon className="text-blue-500" />}
                            title="Convert to JPG"
                            format="JPG"
                            description="Compressed image format"
                            onClick={() => handleDownload('jpg')}
                            onQueue={() => addToQueue('jpg')}
                            darkMode={darkMode}
                          />
                          <DownloadCard
                            icon={<ImageIcon className="text-emerald-500" />}
                            title="Convert to WebP"
                            format="WEBP"
                            description="Modern web image format"
                            onClick={() => handleDownload('webp')}
                            onQueue={() => addToQueue('webp')}
                            darkMode={darkMode}
                          />
                          <DownloadCard
                            icon={<Globe className="text-zinc-500" />}
                            title="Original Image"
                            format="RAW"
                            description="Download as-is from server"
                            onClick={() => handleDownload('raw')}
                            onQueue={() => addToQueue('raw')}
                            darkMode={darkMode}
                          />
                        </>
                      ) : (
                        <DownloadCard
                          icon={<FileText className="text-zinc-500" />}
                          title="Original Asset"
                          format="RAW"
                          description="Download the raw file directly"
                          onClick={() => handleDownload('raw')}
                          onQueue={() => addToQueue('raw')}
                          darkMode={darkMode}
                        />
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Queue & History */}
          <div className="lg:col-span-4 space-y-8">
            {/* Download Queue */}
            <section className={cn(
              "rounded-[2.5rem] p-8 space-y-6 shadow-sm border",
              darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
            )}>
              <div className="flex items-center justify-between">
                <div className={cn(
                  "flex items-center gap-2 font-black uppercase tracking-[0.1em]",
                  darkMode ? "text-white" : "text-zinc-900"
                )}>
                  <Download size={20} className="text-emerald-500" />
                  <h3>Queue</h3>
                </div>
                {queue.some(item => item.status === 'completed') && (
                  <button 
                    onClick={clearCompleted}
                    className="text-[10px] font-black text-zinc-500 hover:text-emerald-500 uppercase tracking-widest transition-colors"
                  >
                    Clear Done
                  </button>
                )}
              </div>
              
              <div className="space-y-4">
                {queue.length > 0 ? (
                  <AnimatePresence initial={false}>
                    {queue.map((item) => (
                      <motion.div
                        key={item.id}
                        layout
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className={cn(
                          "p-5 rounded-2xl border space-y-4 transition-colors",
                          darkMode ? "bg-zinc-800/50 border-zinc-700" : "bg-zinc-50 border-zinc-100"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className={cn(
                              "text-sm font-bold truncate",
                              darkMode ? "text-white" : "text-zinc-900"
                            )}>{item.title}</div>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={cn(
                                "text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest",
                                darkMode ? "bg-zinc-700 text-zinc-400" : "bg-zinc-200 text-zinc-500"
                              )}>
                                {item.format}
                              </span>
                              <span className={cn(
                                "text-[9px] font-black uppercase tracking-widest",
                                item.status === 'completed' ? "text-emerald-500" : 
                                item.status === 'downloading' ? "text-blue-500" :
                                item.status === 'error' ? "text-red-500" : "text-zinc-500"
                              )}>
                                {item.status}
                              </span>
                            </div>
                          </div>
                          <button 
                            onClick={() => removeFromQueue(item.id)}
                            className="p-1.5 text-zinc-500 hover:text-red-500 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                        
                        {(item.status === 'downloading' || item.status === 'pending') && (
                          <div className={cn(
                            "h-1.5 rounded-full overflow-hidden",
                            darkMode ? "bg-zinc-700" : "bg-zinc-200"
                          )}>
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${item.progress}%` }}
                              className={cn(
                                "h-full transition-all duration-500",
                                item.status === 'downloading' ? "bg-emerald-500" : "bg-zinc-400"
                              )}
                            />
                          </div>
                        )}
                        
                        {item.error && (
                          <p className="text-[10px] text-red-400 font-bold leading-tight uppercase tracking-wide">
                            {item.error}
                          </p>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                ) : (
                  <div className={cn(
                    "py-12 text-center border-2 border-dashed rounded-[2rem] flex flex-col items-center gap-3",
                    darkMode ? "border-zinc-800" : "border-zinc-100"
                  )}>
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center",
                      darkMode ? "bg-zinc-800 text-zinc-600" : "bg-zinc-50 text-zinc-300"
                    )}>
                      <List size={24} />
                    </div>
                    <div className="space-y-1">
                      <p className={cn("text-sm font-bold", darkMode ? "text-zinc-600" : "text-zinc-400")}>Queue is empty</p>
                      <p className={cn("text-[10px] uppercase tracking-widest font-black", darkMode ? "text-zinc-700" : "text-zinc-300")}>Add files to process</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className={cn(
              "rounded-[2.5rem] p-8 space-y-6 border",
              darkMode ? "bg-zinc-900 border-zinc-800" : "bg-white border-zinc-200"
            )}>
              <div className={cn(
                "flex items-center gap-2 font-black uppercase tracking-[0.1em]",
                darkMode ? "text-white" : "text-zinc-900"
              )}>
                <History size={20} className="text-emerald-500" />
                <h3>History</h3>
              </div>
              <div className="space-y-3">
                {recentUrls.length > 0 ? (
                  recentUrls.map((rUrl, i) => (
                    <motion.button
                      key={rUrl}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      onClick={() => { setUrl(rUrl); analyzeUrl(undefined, rUrl); }}
                      className={cn(
                        "w-full flex items-center justify-between p-4 rounded-2xl border transition-all group text-left",
                        darkMode 
                          ? "bg-zinc-800/50 border-zinc-700 hover:border-emerald-500/50 hover:bg-emerald-500/5" 
                          : "bg-zinc-50 border-zinc-100 hover:border-emerald-200 hover:bg-emerald-50/30"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Globe size={16} className="text-zinc-500 shrink-0" />
                        <span className={cn(
                          "text-sm font-semibold truncate",
                          darkMode ? "text-zinc-400 group-hover:text-zinc-200" : "text-zinc-600"
                        )}>{rUrl}</span>
                      </div>
                      <ChevronRight size={16} className={cn(
                        "transition-colors",
                        darkMode ? "text-zinc-700 group-hover:text-emerald-500" : "text-zinc-300 group-hover:text-emerald-500"
                      )} />
                    </motion.button>
                  ))
                ) : (
                  <div className="py-8 text-center">
                    <p className={cn("text-sm font-bold", darkMode ? "text-zinc-700" : "text-zinc-400")}>No recent activity</p>
                  </div>
                )}
              </div>
            </section>

            <section className={cn(
              "rounded-[2.5rem] p-8 space-y-8 shadow-2xl border",
              darkMode 
                ? "bg-zinc-900 border-zinc-800 shadow-emerald-950/20" 
                : "bg-zinc-900 border-zinc-800 shadow-zinc-200 text-white"
            )}>
              <div className="space-y-3">
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Technical Specs</h3>
                <p className="text-zinc-400 text-xs leading-relaxed font-medium">
                  Our system uses a secure proxy layer to bypass cross-origin restrictions, allowing you to fetch content from any public server.
                </p>
              </div>
              
              {isFsSupported && (
                <div className="p-5 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-between group hover:border-emerald-500/50 transition-colors">
                  <div className="space-y-1">
                    <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Custom Location</div>
                    <div className="text-xs font-bold text-zinc-300">Choose where to save</div>
                  </div>
                  <button 
                    onClick={() => setUseFileSystemApi(!useFileSystemApi)}
                    className={cn(
                      "w-12 h-6 rounded-full transition-all relative",
                      useFileSystemApi ? "bg-emerald-500" : "bg-zinc-700"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm",
                      useFileSystemApi ? "left-7" : "left-1"
                    )} />
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-5 bg-white/5 rounded-3xl border border-white/10">
                  <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">Engine</div>
                  <div className="text-sm font-mono font-bold text-zinc-300">Axios 1.x</div>
                </div>
                <div className="p-5 bg-white/5 rounded-3xl border border-white/10">
                  <div className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2">Parser</div>
                  <div className="text-sm font-mono font-bold text-zinc-300">Turndown</div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={cn(
        "max-w-6xl mx-auto px-6 py-16 border-t text-center",
        darkMode ? "border-zinc-800" : "border-zinc-200"
      )}>
        <p className={cn(
          "text-[10px] font-black tracking-[0.3em] uppercase",
          darkMode ? "text-zinc-600" : "text-zinc-400"
        )}>
          &copy; {new Date().getFullYear()} UNIVERSAL DOWNLOADER // DESIGNED FOR THE OPEN WEB
        </p>
      </footer>
    </div>
  );
}

function DownloadCard({ icon, title, format, description, onClick, onQueue, darkMode }: { icon: React.ReactNode, title: string, format: string, description: string, onClick: () => void, onQueue?: () => void, darkMode?: boolean }) {
  return (
    <motion.div
      whileHover={{ y: -6 }}
      className={cn(
        "group relative flex flex-col rounded-3xl border transition-all overflow-hidden",
        darkMode 
          ? "bg-zinc-800/40 border-zinc-700 hover:border-emerald-500/50 hover:shadow-2xl hover:shadow-emerald-500/10" 
          : "bg-white border-zinc-200 hover:border-emerald-500 hover:shadow-2xl hover:shadow-emerald-500/10"
      )}
    >
      <button
        onClick={onClick}
        className="flex flex-col items-start p-7 text-left w-full"
      >
        <div className={cn(
          "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-colors mb-5",
          darkMode ? "bg-zinc-800 group-hover:bg-emerald-500/10" : "bg-zinc-50 group-hover:bg-emerald-50"
        )}>
          {icon}
        </div>
        <div className="space-y-2 w-full">
          <div className="flex items-center justify-between">
            <div className={cn(
              "text-lg font-black tracking-tight transition-colors",
              darkMode ? "text-white group-hover:text-emerald-400" : "text-zinc-900 group-hover:text-emerald-700"
            )}>
              {title}
            </div>
            <span className={cn(
              "text-[10px] font-black px-2.5 py-1 rounded-xl transition-colors uppercase tracking-widest",
              darkMode 
                ? "bg-zinc-700 text-zinc-400 group-hover:bg-emerald-500/20 group-hover:text-emerald-400" 
                : "bg-zinc-100 text-zinc-500 group-hover:bg-emerald-100 group-hover:text-emerald-700"
            )}>
              {format}
            </span>
          </div>
          <p className={cn(
            "text-xs font-semibold leading-relaxed",
            darkMode ? "text-zinc-500" : "text-zinc-400"
          )}>{description}</p>
        </div>
      </button>
      
      {onQueue && (
        <button
          onClick={(e) => { e.stopPropagation(); onQueue(); }}
          className={cn(
            "absolute top-5 right-5 p-2.5 rounded-xl transition-all opacity-0 group-hover:opacity-100 shadow-lg",
            darkMode 
              ? "bg-zinc-700 text-zinc-300 hover:bg-emerald-500 hover:text-zinc-950" 
              : "bg-zinc-50 text-zinc-400 hover:bg-emerald-600 hover:text-white"
          )}
          title="Add to Queue"
        >
          <History size={16} />
        </button>
      )}
      
      <div className="absolute bottom-0 left-0 w-full h-1.5 bg-emerald-500 transform translate-y-full group-hover:translate-y-0 transition-transform" />
    </motion.div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="p-6 bg-white border border-zinc-200 rounded-2xl space-y-3 shadow-sm">
      <div className="text-emerald-600">{icon}</div>
      <h3 className="font-bold text-zinc-900">{title}</h3>
      <p className="text-xs text-zinc-500 leading-relaxed font-medium">{description}</p>
    </div>
  );
}

function MetaItem({ label, value }: { label: string, value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{label}</div>
      <div className="text-xs font-mono text-zinc-600 truncate font-medium">{value}</div>
    </div>
  );
}
