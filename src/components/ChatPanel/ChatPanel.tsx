// SPDX-License-Identifier: GPL-3.0-or-later
// LLM Chat Panel for WEISS — EPICS operator assistant
// Contributed by Elmaddin Guliyev

import { useState, useCallback, useRef, useEffect } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import SendIcon from "@mui/icons-material/Send";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import PersonIcon from "@mui/icons-material/Person";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import { COLORS } from "@src/constants/constants";
import type { PVData, PVValue } from "@src/types/epicsWS";

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL = "qwen2.5-coder:1.5b";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  commands?: string[];
}

interface ChatPanelProps {
  open: boolean;
  onClose: () => void;
  pvState: Record<string, PVData>;
  writePVValue: (pv: string, value: PVValue) => void;
}

function buildSystemPrompt(pvState: Record<string, PVData>): string {
  const pvList = Object.entries(pvState)
    .map(([name, data]) => {
      const val = data.value;
      const units = data.display?.units ?? "";
      const low = data.display?.limitLow;
      const high = data.display?.limitHigh;
      const alarm = data.alarm?.severity ?? 0;
      const alarmStr =
        alarm === 0
          ? ""
          : alarm === 1
            ? " [MINOR ALARM]"
            : alarm === 2
              ? " [MAJOR ALARM]"
              : " [INVALID]";
      let range = "";
      if (low !== undefined && high !== undefined) {
        range = ` (range: ${String(low)}-${String(high)} ${units})`;
      }
      return `  ${name} = ${String(val)} ${units}${range}${alarmStr}`;
    })
    .join("\n");

  return `You are an EPICS control system operator assistant for WEISS.
Your job is to help operators interact with the control system using natural language.

RULES:
1. The caput command syntax is: caput PV_NAME VALUE
2. PV values are in engineering units shown below
3. Always check ranges before suggesting values
4. For safety-critical operations, warn the operator
5. When suggesting commands, put each on its own line starting with "caput "
6. Be concise and direct

CURRENTLY SUBSCRIBED PVs AND VALUES:
${pvList}

Answer the operator's question based on the PV data above.`;
}

function extractCommands(text: string): string[] {
  const lines = text.split("\n");
  const commands: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim().replace(/^`+|`+$/g, "");
    if (trimmed.startsWith("caput ")) {
      commands.push(trimmed);
    }
  }
  return commands;
}

export default function ChatPanel({ open, onClose, pvState, writePVValue }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<"checking" | "online" | "offline">("checking");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check Ollama status
  useEffect(() => {
    if (!open) return;
    setOllamaStatus("checking");
    fetch("http://localhost:11434/api/tags")
      .then((res) => {
        if (res.ok) setOllamaStatus("online");
        else setOllamaStatus("offline");
      })
      .catch(() => setOllamaStatus("offline"));
  }, [open]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const systemPrompt = buildSystemPrompt(pvState);
      const res = await fetch(OLLAMA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          prompt: `${systemPrompt}\n\nOperator: ${userMessage.content}\nAssistant:`,
          stream: false,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as { response: string };
        const commands = extractCommands(data.response);
        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: data.response,
          commands,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "Failed to get response from LLM.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Cannot reach Ollama. Make sure it is running on localhost:11434.",
        },
      ]);
    }
    setLoading(false);
  }, [input, loading, pvState]);

  const executeCommand = useCallback(
    (cmd: string) => {
      const parts = cmd.split(/\s+/);
      console.log("Execute command parts:", parts);
      if (parts.length >= 3 && parts[0] === "caput") {
        const pvName = parts[1];
        const value = parts[2];
        const numValue = Number(value);
        console.log("Writing PV:", pvName, "Value:", isNaN(numValue) ? value : numValue);
        writePVValue(pvName, isNaN(numValue) ? value : numValue);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Executed: ${cmd}`,
          },
        ]);
      }
    },
    [writePVValue],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <SmartToyIcon />
        EPICS Operator Assistant
        <Chip
          label={
            ollamaStatus === "online"
              ? `${MODEL}`
              : ollamaStatus === "checking"
                ? "Checking..."
                : "Offline"
          }
          size="small"
          sx={{
            ml: 1,
            backgroundColor:
              ollamaStatus === "online"
                ? `${COLORS.onColor}20`
                : ollamaStatus === "offline"
                  ? `${COLORS.major}20`
                  : `${COLORS.gridLineColor}`,
            color:
              ollamaStatus === "online"
                ? COLORS.onColor
                : ollamaStatus === "offline"
                  ? COLORS.major
                  : COLORS.midGray,
            fontWeight: 600,
            fontSize: 11,
          }}
        />
      </DialogTitle>
      <DialogContent>
        {/* Chat messages */}
        <Box
          sx={{
            height: 400,
            overflow: "auto",
            mb: 2,
            p: 1,
            backgroundColor: COLORS.backgroundColor,
            borderRadius: 1,
          }}
        >
          {messages.length === 0 && (
            <Typography color="text.secondary" sx={{ textAlign: "center", mt: 8 }}>
              Ask me about the system status, suggest parameter changes, or request caput commands.
            </Typography>
          )}
          {messages.map((msg, idx) => (
            <Box
              key={idx}
              sx={{
                display: "flex",
                gap: 1,
                mb: 1.5,
                alignItems: "flex-start",
              }}
            >
              {msg.role === "user" ? (
                <PersonIcon fontSize="small" sx={{ color: COLORS.highlighted, mt: 0.5 }} />
              ) : (
                <SmartToyIcon fontSize="small" sx={{ color: COLORS.onColor, mt: 0.5 }} />
              )}
              <Box sx={{ flex: 1 }}>
                <Typography
                  variant="body2"
                  sx={{
                    whiteSpace: "pre-wrap",
                    fontFamily: msg.role === "assistant" ? "monospace" : "inherit",
                    fontSize: msg.role === "assistant" ? 12 : 14,
                  }}
                >
                  {msg.content}
                </Typography>
                {msg.commands && msg.commands.length > 0 && (
                  <Box sx={{ mt: 1, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                    {msg.commands.map((cmd, cmdIdx) => (
                      <Button
                        key={cmdIdx}
                        size="small"
                        variant="outlined"
                        startIcon={<PlayArrowIcon />}
                        onClick={() => executeCommand(cmd)}
                        sx={{
                          textTransform: "none",
                          fontFamily: "monospace",
                          fontSize: 11,
                        }}
                      >
                        {cmd}
                      </Button>
                    ))}
                  </Box>
                )}
              </Box>
            </Box>
          ))}
          {loading && (
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <SmartToyIcon fontSize="small" sx={{ color: COLORS.onColor }} />
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                Thinking...
              </Typography>
            </Box>
          )}
          <div ref={messagesEndRef} />
        </Box>

        {/* Input */}
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Ask about system status, suggest changes..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            disabled={loading || ollamaStatus === "offline"}
          />
          <IconButton
            color="primary"
            onClick={() => void handleSend()}
            disabled={loading || !input.trim() || ollamaStatus === "offline"}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
