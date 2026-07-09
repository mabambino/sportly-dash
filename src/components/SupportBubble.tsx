import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, MessageSquare, Mail, Send, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";

type Mode = "menu" | "chat" | "email" | "suggest";

type ChatMsg = { role: "user" | "support"; text: string };

export function SupportBubble() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("menu");
  const [messages, setMessages] = useState<ChatMsg[]>([
    { role: "support", text: "Hi! 👋 How can we help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [featureTitle, setFeatureTitle] = useState("");
  const [featureDetails, setFeatureDetails] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, mode]);

  const sendChat = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setTimeout(() => {
      setMessages((m) => [
        ...m,
        { role: "support", text: "Thanks! A team member will reply shortly." },
      ]);
    }, 800);
  };

  const sendEmail = () => {
    if (!email.trim() || !subject.trim() || !body.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    toast.success("Email sent! We'll get back to you soon.");
    setEmail("");
    setSubject("");
    setBody("");
    setMode("menu");
    setOpen(false);
  };

  const sendSuggestion = () => {
    if (!featureTitle.trim() || !featureDetails.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    toast.success(t("support.suggestThanks"));
    setFeatureTitle("");
    setFeatureDetails("");
    setMode("menu");
    setOpen(false);
  };

  return (
    <>
      {open && (
        <div className="fixed bottom-40 right-4 z-50 w-[calc(100vw-2rem)] max-w-sm lg:bottom-24 rounded-2xl border bg-background shadow-2xl sm:right-6 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">
                {mode === "menu" && t("support.title")}
                {mode === "chat" && t("support.liveChat")}
                {mode === "email" && t("support.email")}
                {mode === "suggest" && t("support.suggest")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {mode === "menu" && t("support.how")}
                {mode === "chat" && "Typically replies in a few minutes"}
                {mode === "email" && "We'll respond within 24 hours"}
                {mode === "suggest" && t("support.suggestSub")}
              </p>
            </div>
            <div className="flex gap-1">
              {mode !== "menu" && (
                <Button variant="ghost" size="sm" onClick={() => setMode("menu")} className="h-7 px-2 text-xs">
                  Back
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {mode === "menu" && (
            <div className="space-y-2 p-4">
              <button
                onClick={() => setMode("chat")}
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-medium">{t("support.liveChat")}</div>
                  <div className="text-xs text-muted-foreground">{t("support.liveChatSub")}</div>
                </div>
              </button>
              <button
                onClick={() => setMode("email")}
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-medium">{t("support.email")}</div>
                  <div className="text-xs text-muted-foreground">{t("support.emailSub")}</div>
                </div>
              </button>
              <button
                onClick={() => setMode("suggest")}
                className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:bg-accent"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Lightbulb className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-medium">{t("support.suggest")}</div>
                  <div className="text-xs text-muted-foreground">{t("support.suggestSub")}</div>
                </div>
              </button>
            </div>
          )}

          {mode === "chat" && (
            <div className="flex h-96 flex-col">
              <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto p-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 border-t p-3">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChat()}
                  placeholder="Type a message..."
                />
                <Button size="icon" onClick={sendChat}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {mode === "email" && (
            <div className="space-y-3 p-4">
              <Input
                type="email"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              />
              <Textarea
                placeholder="How can we help?"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
              />
              <Button className="w-full" onClick={sendEmail}>
                <Mail className="mr-2 h-4 w-4" /> Send email
              </Button>
            </div>
          )}

          {mode === "suggest" && (
            <div className="space-y-3 p-4">
              <Input
                placeholder="Feature title (e.g. Export attendance to Excel)"
                value={featureTitle}
                onChange={(e) => setFeatureTitle(e.target.value)}
              />
              <Textarea
                placeholder="Describe the feature and why it would help you…"
                rows={5}
                value={featureDetails}
                onChange={(e) => setFeatureDetails(e.target.value)}
              />
              <Button className="w-full" onClick={sendSuggestion}>
                <Lightbulb className="mr-2 h-4 w-4" /> {t("support.suggest")}
              </Button>
            </div>
          )}
        </div>
      )}

      <button
        data-hide-on-keyboard
        onClick={() => setOpen((o) => !o)}
        aria-label="Support"
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 lg:bottom-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 hover:shadow-xl sm:right-6"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
}
