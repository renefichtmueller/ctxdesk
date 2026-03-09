"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/components/providers/language-provider";
import { LOCALES, Locale } from "@/lib/i18n";
import {
  Settings, Brain, Globe, RefreshCw, CheckCircle2, XCircle,
  Zap, ChevronDown, Copy, ArrowLeftRight, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  size?: string;
  description?: string;
}

interface ModelsData {
  ollama: ModelInfo[];
  lmstudio: ModelInfo[];
  all: ModelInfo[];
  ollamaOnline: boolean;
  lmStudioOnline: boolean;
  ollamaSource?: "local" | "remote" | "none";
}

const LANGUAGES_FOR_TRANSLATE: Array<{ code: string; name: string; flag: string }> = [
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
  { code: "nl", name: "Nederlands", flag: "🇳🇱" },
  { code: "pl", name: "Polski", flag: "🇵🇱" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "tr", name: "Türkçe", flag: "🇹🇷" },
  { code: "sv", name: "Svenska", flag: "🇸🇪" },
  { code: "da", name: "Dansk", flag: "🇩🇰" },
  { code: "no", name: "Norsk", flag: "🇳🇴" },
  { code: "fi", name: "Suomi", flag: "🇫🇮" },
  { code: "cs", name: "Čeština", flag: "🇨🇿" },
  { code: "hu", name: "Magyar", flag: "🇭🇺" },
  { code: "ro", name: "Română", flag: "🇷🇴" },
];

type Tab = "general" | "llm" | "translator";

function SectionCard({ title, icon: Icon, accent = "#6366f1", children }: {
  title: string; icon: React.ElementType; accent?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: "#1e293b", border: `1px solid ${accent}22` }}>
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderBottom: `1px solid ${accent}15`, background: `${accent}08` }}>
        <Icon className="w-4 h-4 shrink-0" style={{ color: accent }} />
        <span className="text-[13px] font-semibold" style={{ color: accent }}>{title}</span>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function ProviderStatus({ online, label }: { online: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {online
        ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
        : <XCircle className="w-3.5 h-3.5 text-red-400" />}
      <span className={`text-[12px] ${online ? "text-emerald-400" : "text-red-400"}`}>{label}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { locale, setLocale, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<Tab>("general");

  // LLM State
  const [ollamaUrl, setOllamaUrl] = useState("http://localhost:11434");
  const [lmStudioUrl, setLmStudioUrl] = useState("http://localhost:1234");
  const [remoteOllamaUrl, setRemoteOllamaUrl] = useState("https://ollama.example.com");
  const [ollamaApiKey, setOllamaApiKey] = useState("");
  const [models, setModels] = useState<ModelsData | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);

  // Translator State
  const [translateText, setTranslateText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [targetLang, setTargetLang] = useState("en");
  const [translating, setTranslating] = useState(false);
  const [translateModel, setTranslateModel] = useState("");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("ctxdesk-llm-config");
      if (stored) {
        const cfg = JSON.parse(stored);
        if (cfg.ollamaUrl) setOllamaUrl(cfg.ollamaUrl);
        if (cfg.lmStudioUrl) setLmStudioUrl(cfg.lmStudioUrl);
        if (cfg.remoteOllamaUrl) setRemoteOllamaUrl(cfg.remoteOllamaUrl);
        if (cfg.ollamaApiKey) setOllamaApiKey(cfg.ollamaApiKey);
      }
    } catch {}
    fetchModels();
  }, []);

  async function fetchModels() {
    setLoadingModels(true);
    try {
      const params = new URLSearchParams({
        ollamaUrl,
        lmStudioUrl,
        remoteOllamaUrl,
        ...(ollamaApiKey ? { ollamaApiKey } : {}),
      });
      const res = await fetch(`/api/llm/models?${params}`);
      const data = await res.json();
      setModels(data);
    } catch {
      toast.error("LLM-Verbindung fehlgeschlagen");
    } finally {
      setLoadingModels(false);
    }
  }

  function saveLLMConfig() {
    try {
      localStorage.setItem("ctxdesk-llm-config", JSON.stringify({ ollamaUrl, lmStudioUrl, remoteOllamaUrl, ollamaApiKey }));
      toast.success("LLM-Konfiguration gespeichert");
      fetchModels();
    } catch {
      toast.error("Konnte nicht gespeichert werden");
    }
  }

  async function handleTranslate() {
    if (!translateText.trim()) return;
    setTranslating(true);
    setTranslatedText("");
    setTranslateModel("");
    try {
      const res = await fetch("/api/llm/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: translateText,
          targetLang,
          ollamaUrl,
          lmStudioUrl,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTranslatedText(data.translated);
      setTranslateModel(data.model);
    } catch (err) {
      toast.error(String(err));
    } finally {
      setTranslating(false);
    }
  }

  const tabs: Array<{ id: Tab; label: string; icon: React.ElementType }> = [
    { id: "general", label: t("general"), icon: Settings },
    { id: "llm", label: t("ai"), icon: Brain },
    { id: "translator", label: t("translator"), icon: Globe },
  ];

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(99,102,241,0.15)", border: "1px solid rgba(99,102,241,0.3)" }}>
          <Settings className="w-4 h-4 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-[#f1f5f9]">{t("settings")}</h1>
          <p className="text-[12px] text-[#64748b]">CtxDesk Konfiguration</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-150 flex-1 justify-center",
              activeTab === tab.id
                ? "bg-[#1e293b] text-[#f1f5f9]"
                : "text-[#64748b] hover:text-[#94a3b8]"
            )}
          >
            <tab.icon className="w-3.5 h-3.5" style={{ color: activeTab === tab.id ? "#6366f1" : undefined }} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* General Tab */}
      {activeTab === "general" && (
        <div className="space-y-4">
          <SectionCard title={t("uiLanguage")} icon={Globe} accent="#6366f1">
            <div>
              <p className="text-[12px] text-[#64748b] mb-3">Wähle die Sprache der Benutzeroberfläche</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.entries(LOCALES) as Array<[Locale, { name: string; flag: string }]>).map(([code, info]) => (
                  <button
                    key={code}
                    onClick={() => { setLocale(code); toast.success(`${info.flag} ${info.name} aktiviert`); }}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150",
                      locale === code
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40"
                        : "bg-[#0f172a] text-[#64748b] border border-[#1e293b] hover:border-[#334155] hover:text-[#94a3b8]"
                    )}
                  >
                    <span className="text-lg">{info.flag}</span>
                    <span>{info.name}</span>
                    {locale === code && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-indigo-400" />}
                  </button>
                ))}
              </div>
            </div>
          </SectionCard>
        </div>
      )}

      {/* LLM Tab */}
      {activeTab === "llm" && (
        <div className="space-y-4">
          <SectionCard title="Ollama" icon={Brain} accent="#6366f1">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <ProviderStatus online={models?.ollamaOnline ?? false} label={models?.ollamaOnline ? `Online · ${models.ollama.length} Modelle` : "Offline"} />
                <button
                  onClick={fetchModels}
                  disabled={loadingModels}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-[#64748b] hover:text-[#94a3b8] hover:bg-[#1e293b] transition-all"
                >
                  <RefreshCw className={cn("w-3 h-3", loadingModels && "animate-spin")} />
                  Refresh
                </button>
              </div>
              <div>
                <label className="text-[11px] text-[#64748b] mb-1 block">URL</label>
                <input
                  value={ollamaUrl}
                  onChange={e => setOllamaUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-[13px] text-[#f1f5f9] outline-none transition-all"
                  style={{ background: "#0f172a", border: "1px solid #334155" }}
                  placeholder="http://localhost:11434"
                />
              </div>
              {models?.ollama && models.ollama.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-[#64748b]">{t("availableModels")}</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {models.ollama.map(m => (
                      <div key={m.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                        <span className="text-[12px] text-[#94a3b8] flex-1 font-mono">{m.id}</span>
                        {m.size && <span className="text-[10px] text-[#475569]">{m.size}</span>}
                        {m.description && <span className="text-[10px] text-[#64748b]">{m.description}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Remote Ollama (Mac Studio via Tunnel) */}
          <SectionCard title="Remote Ollama — Mac Studio Tunnel" icon={Zap} accent="#06b6d4">
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-[11px]" style={{ background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.2)", color: "#67e8f9" }}>
                <span>🌐</span>
                <span>Automatischer Fallback: Lokal → Tunnel wenn unterwegs</span>
                {models?.ollamaSource && (
                  <span className="ml-auto font-mono" style={{ color: models.ollamaSource === "remote" ? "#34d399" : models.ollamaSource === "local" ? "#a5b4fc" : "#ef4444" }}>
                    {models.ollamaSource === "remote" ? "● Remote" : models.ollamaSource === "local" ? "● Lokal" : "● Offline"}
                  </span>
                )}
              </div>
              <div>
                <label className="text-[11px] text-[#64748b] mb-1 block">Remote URL (Tunnel)</label>
                <input
                  value={remoteOllamaUrl}
                  onChange={e => setRemoteOllamaUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-[13px] text-[#f1f5f9] outline-none transition-all font-mono"
                  style={{ background: "#0f172a", border: "1px solid #334155" }}
                  placeholder="https://ollama.example.com"
                />
              </div>
              <div>
                <label className="text-[11px] text-[#64748b] mb-1 block">API Key</label>
                <input
                  type="password"
                  value={ollamaApiKey}
                  onChange={e => setOllamaApiKey(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-[13px] text-[#f1f5f9] outline-none transition-all font-mono"
                  style={{ background: "#0f172a", border: "1px solid #334155" }}
                  placeholder="Bearer Token für Remote-Zugriff"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="LM Studio" icon={Zap} accent="#a855f7">
            <div className="space-y-3">
              <ProviderStatus online={models?.lmStudioOnline ?? false} label={models?.lmStudioOnline ? `Online · ${models!.lmstudio.length} Modelle` : "Offline"} />
              <div>
                <label className="text-[11px] text-[#64748b] mb-1 block">URL</label>
                <input
                  value={lmStudioUrl}
                  onChange={e => setLmStudioUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-[13px] text-[#f1f5f9] outline-none transition-all"
                  style={{ background: "#0f172a", border: "1px solid #334155" }}
                  placeholder="http://localhost:1234"
                />
              </div>
              {models?.lmstudio && models.lmstudio.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-[#64748b]">{t("availableModels")}</p>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {models.lmstudio.map(m => (
                      <div key={m.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                        <span className="text-[12px] text-[#94a3b8] flex-1 font-mono">{m.id.split("/").pop()}</span>
                        {m.description && <span className="text-[10px] text-[#64748b]">{m.description}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          <button
            onClick={saveLLMConfig}
            className="w-full py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-150"
            style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc", border: "1px solid rgba(99,102,241,0.3)" }}
          >
            Konfiguration speichern & verbinden
          </button>
        </div>
      )}

      {/* Translator Tab */}
      {activeTab === "translator" && (
        <div className="space-y-4">
          <SectionCard title={t("translator")} icon={Globe} accent="#22c55e">
            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "#0f172a", border: "1px solid #1e293b" }}>
                {models?.ollamaOnline || models?.lmStudioOnline
                  ? <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /><span className="text-[12px] text-emerald-400">LLM verfügbar — Übersetzung möglich</span></>
                  : <><XCircle className="w-3.5 h-3.5 text-red-400" /><span className="text-[12px] text-red-400">Kein LLM verfügbar — Ollama oder LM Studio starten</span></>}
              </div>

              {/* Target Language Selector */}
              <div>
                <label className="text-[11px] text-[#64748b] mb-2 block">Zielsprache</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5 max-h-48 overflow-y-auto">
                  {LANGUAGES_FOR_TRANSLATE.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => setTargetLang(lang.code)}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium transition-all",
                        targetLang === lang.code
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "text-[#64748b] border border-[#1e293b] hover:border-[#334155] hover:text-[#94a3b8]"
                      )}
                    >
                      <span>{lang.flag}</span>
                      <span className="truncate">{lang.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Input */}
              <div>
                <label className="text-[11px] text-[#64748b] mb-1 block">Originaltext</label>
                <textarea
                  value={translateText}
                  onChange={e => setTranslateText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleTranslate(); }}
                  placeholder="Text hier eingeben oder einfügen... (Ctrl+Enter zum Übersetzen)"
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg text-[13px] text-[#f1f5f9] outline-none resize-none transition-all"
                  style={{ background: "#0f172a", border: "1px solid #334155" }}
                />
              </div>

              {/* Translate Button */}
              <button
                onClick={handleTranslate}
                disabled={translating || !translateText.trim() || (!models?.ollamaOnline && !models?.lmStudioOnline)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-semibold transition-all duration-150 disabled:opacity-50"
                style={{ background: "rgba(34,197,94,0.15)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.3)" }}
              >
                {translating
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Übersetze...</>
                  : <><ArrowLeftRight className="w-4 h-4" /> Übersetzen ({LANGUAGES_FOR_TRANSLATE.find(l => l.code === targetLang)?.flag} {LANGUAGES_FOR_TRANSLATE.find(l => l.code === targetLang)?.name})</>}
              </button>

              {/* Result */}
              {translatedText && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] text-[#64748b]">
                      Übersetzung {translateModel && <span className="text-[#475569]">via {translateModel}</span>}
                    </label>
                    <button
                      onClick={() => { navigator.clipboard.writeText(translatedText); toast.success("Kopiert!"); }}
                      className="flex items-center gap-1 text-[10px] text-[#64748b] hover:text-[#94a3b8] transition-colors"
                    >
                      <Copy className="w-3 h-3" /> Kopieren
                    </button>
                  </div>
                  <div
                    className="px-3 py-3 rounded-lg text-[13px] text-[#e2e8f0] leading-relaxed whitespace-pre-wrap"
                    style={{ background: "#0f172a", border: "1px solid rgba(34,197,94,0.2)" }}
                  >
                    {translatedText}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
