import { useState } from 'react';
import { Settings, Play, Link as LinkIcon, AlertCircle, Copy, ExternalLink, Film } from 'lucide-react';

interface Source {
  url: string;
  name: string;
}

export function App() {
  const [sources, setSources] = useState<Source[]>([{ url: '', name: '' }]);
  const [tmdbKey, setTmdbKey] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');

  const addSource = () => {
    setSources([...sources, { url: '', name: '' }]);
  };

  const removeSource = (index: number) => {
    const newSources = sources.filter((_, i) => i !== index);
    setSources(newSources);
  };

  const updateSource = (index: number, field: keyof Source, value: string) => {
    const newSources = [...sources];
    newSources[index][field] = value;
    setSources(newSources);
  };

  const generateLink = () => {
    const validSources = sources.filter(s => s.url);
    if (validSources.length === 0) return;

    const config = {
      sources: validSources,
      tmdbKey
    };

    const configStr = btoa(JSON.stringify(config));
    const baseUrl = window.location.origin;
    // Remove trailing slash if present
    const cleanBaseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const manifestUrl = `${cleanBaseUrl}/${configStr}/manifest.json`;
    setGeneratedUrl(manifestUrl);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedUrl);
    alert('Copied to clipboard!');
  };

  const installAddon = () => {
    // stremio:// protocol
    const stremioUrl = generatedUrl.replace('https://', 'stremio://').replace('http://', 'stremio://');
    window.location.href = stremioUrl;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-indigo-500 selection:text-white">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-6 h-6 text-indigo-500" />
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              M3U Stremio Addon
            </h1>
          </div>
          <a href="https://github.com/stremio/stremio-addon-sdk" target="_blank" rel="noreferrer" className="text-sm text-slate-400 hover:text-white transition-colors">
            Stremio SDK Docs
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <div className="space-y-8">
          
          <div className="bg-slate-900 rounded-xl p-8 border border-slate-800 shadow-xl">
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-white mb-2">Configuration</h2>
                <p className="text-slate-400">
                  Configure your addon by providing M3U playlist URLs. You can add multiple sources.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  M3U Sources <span className="text-red-400">*</span>
                </label>
                
                <div className="space-y-4">
                  {sources.map((source, index) => (
                    <div key={index} className="flex flex-col gap-2 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <input
                            type="text"
                            value={source.name}
                            onChange={(e) => updateSource(index, 'name', e.target.value)}
                            placeholder="Source Name (e.g. Movies 4K)"
                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-md text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                        <button
                          onClick={() => removeSource(index)}
                          className="px-3 py-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-md transition-colors"
                          disabled={sources.length === 1}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <LinkIcon className="h-4 w-4 text-slate-500" />
                        </div>
                        <input
                          type="url"
                          value={source.url}
                          onChange={(e) => updateSource(index, 'url', e.target.value)}
                          placeholder="https://example.com/playlist.m3u"
                          className="block w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-600 rounded-md focus:outline-none focus:border-indigo-500 text-white placeholder-slate-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                
                <button
                  onClick={addSource}
                  className="mt-3 text-sm text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
                >
                  + Add another source
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  TMDB API Key (Optional)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <AlertCircle className="h-5 w-5 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    value={tmdbKey}
                    onChange={(e) => setTmdbKey(e.target.value)}
                    placeholder="Your TMDB API Key"
                    className="block w-full pl-10 pr-3 py-3 bg-slate-800 border border-slate-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-white placeholder-slate-500 transition-all"
                  />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Required for fetching posters, ratings, and descriptions. Get one at <a href="https://www.themoviedb.org/documentation/api" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">themoviedb.org</a>.
                </p>
              </div>

              <button
                onClick={generateLink}
                disabled={!sources.some(s => s.url)}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2"
              >
                <Settings className="w-5 h-5" />
                Generate Addon Link
              </button>
            </div>
          </div>

          {generatedUrl && (
            <div className="bg-slate-900 rounded-xl p-8 border border-slate-800 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-start gap-4 mb-6">
                <div className="p-3 bg-green-500/10 rounded-lg text-green-400">
                  <Play className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-white mb-2">Install Addon</h2>
                  <p className="text-slate-400">
                    Your addon is ready! Click the button below to install it on Stremio, or copy the link to share.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-950 rounded-lg border border-slate-800 break-all text-sm text-slate-400 font-mono mb-6">
                {generatedUrl}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={installAddon}
                  className="flex-1 py-3 px-4 bg-green-600 hover:bg-green-500 rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-5 h-5" />
                  Install on Stremio
                </button>
                <button
                  onClick={copyToClipboard}
                  className="flex-1 py-3 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg font-medium text-white transition-colors flex items-center justify-center gap-2"
                >
                  <Copy className="w-5 h-5" />
                  Copy Link
                </button>
              </div>
            </div>
          )}

          <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-800/50">
             <h3 className="text-lg font-semibold text-white mb-2">Instructions</h3>
             <ul className="list-disc list-inside space-y-2 text-slate-400">
               <li>Ensure your M3U link is publicly accessible.</li>
               <li>If using TMDB, ensure your API key is valid.</li>
               <li>Once installed, this addon will appear in your Stremio "Movies" catalog.</li>
               <li>Streams will be grouped by Movie Title and Source.</li>
             </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
