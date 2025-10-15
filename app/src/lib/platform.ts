import type { Message } from "@/App";

type InvokeArgs = Record<string, unknown> | undefined;
type Listener<T = unknown> = (event: { event: string; payload: T }) => void;
export type UnlistenFn = () => void;

type PromptStatus = "running" | "stopped" | "loading" | "na";

type Container = {
  id: string;
  vnc_port: number;
  number: number;
  agent_type: "jim" | "pam";
  agent_name: string;
  message_ids: string[];
  agent_id: string;
  system_prompt: string;
};

type User = {
  show_controls: boolean;
};

const envPlatform = import.meta.env.VITE_PLATFORM;
const runtimePlatform = envPlatform ?? (typeof window !== "undefined" && "__TAURI__" in window ? "tauri" : "web");

export const isWebPlatform = runtimePlatform === "web";

type TauriCoreModule = typeof import("@tauri-apps/api/core");
type TauriEventModule = typeof import("@tauri-apps/api/event");

let tauriCore: TauriCoreModule | null = null;
let tauriEvent: TauriEventModule | null = null;

async function loadTauriCore(): Promise<TauriCoreModule> {
  if (!tauriCore) {
    tauriCore = await import("@tauri-apps/api/core");
  }
  return tauriCore;
}

async function loadTauriEvent(): Promise<TauriEventModule> {
  if (!tauriEvent) {
    tauriEvent = await import("@tauri-apps/api/event");
  }
  return tauriEvent;
}

export async function invoke<T>(command: string, args?: InvokeArgs): Promise<T> {
  if (!isWebPlatform) {
    const { invoke } = await loadTauriCore();
    return invoke<T>(command, args);
  }
  return webInvoke<T>(command, args);
}

export async function listen<T>(eventName: string, handler: Listener<T>): Promise<UnlistenFn> {
  if (!isWebPlatform) {
    const { listen } = await loadTauriEvent();
    return listen(eventName, handler) as unknown as Promise<UnlistenFn>;
  }
  if (eventName === "setup-complete") {
    const timeout = window.setTimeout(() => {
      handler({ event: eventName, payload: undefined as T });
    }, 0);
    return Promise.resolve(() => window.clearTimeout(timeout));
  }
  return Promise.resolve(() => undefined);
}

export async function emit<T>(eventName: string, payload?: T): Promise<void> {
  if (!isWebPlatform) {
    const { emit } = await loadTauriEvent();
    await emit(eventName, payload);
  }
}

export function getWebSocketUrl(): string | null {
  return isWebPlatform ? null : "ws://localhost:3030/ws";
}

let messageCounter = 1;

const defaultAgentId = "pam-1";

const stubState: {
  user: User;
  containers: Container[];
  messages: Map<string, Message[]>;
  promptStatus: Map<string, PromptStatus>;
} = {
  user: { show_controls: true },
  containers: [],
  messages: new Map(),
  promptStatus: new Map(),
};

function ensureDefaultData(): void {
  if (stubState.containers.length > 0) return;

  const welcomeMessage: Message = {
    "message-type": "message",
    message_id: nextWebMessageId(),
    agent_id: defaultAgentId,
    text: "This is a static web preview of Radah. Desktop-specific features are disabled.",
    show_ui: true,
  };

  const container: Container = {
    id: "web-container-pam-1",
    vnc_port: 6080,
    number: 1,
    agent_type: "pam",
    agent_name: "P.A.M. (Preview)",
    message_ids: [welcomeMessage.message_id],
    agent_id: defaultAgentId,
    system_prompt: "You are a helpful assistant.",
  };

  stubState.containers.push(container);
  stubState.messages.set(defaultAgentId, [welcomeMessage]);
  stubState.promptStatus.set(defaultAgentId, "stopped");
}

ensureDefaultData();

export function nextWebMessageId(): string {
  return `web-msg-${messageCounter++}`;
}

export function recordWebMessage(agentId: string, message: Message): void {
  if (!isWebPlatform) return;
  const existing = stubState.messages.get(agentId) ?? [];
  stubState.messages.set(agentId, [...existing, message]);

  const container = stubState.containers.find((item) => item.agent_id === agentId);
  if (container && !container.message_ids.includes(message.message_id)) {
    container.message_ids = [...container.message_ids, message.message_id];
  }
}

export function setWebPromptStatus(agentId: string, status: PromptStatus): void {
  if (!isWebPlatform) return;
  stubState.promptStatus.set(agentId, status);
}

export function createWebAgentReply(agentId: string): Message {
  return {
    "message-type": "message",
    message_id: nextWebMessageId(),
    agent_id: agentId,
    text: "Thanks for trying the web preview! The desktop app connects this UI to live agents.",
    show_ui: true,
  };
}

async function webInvoke<T>(command: string, args?: InvokeArgs): Promise<T> {
  ensureDefaultData();

  switch (command) {
    case "is_setup_complete":
      return true as T;
    case "get_user_data":
      return structuredClone({ ...stubState.user }) as T;
    case "get_all_containers":
      return structuredClone(stubState.containers) as T;
    case "create_agent_container": {
      const { agentId, agentType, agentName, number, systemPrompt } = (args ?? {}) as {
        agentId: string;
        agentType: "jim" | "pam";
        agentName: string;
        number: number;
        systemPrompt: string;
      };

      const container: Container = {
        id: `web-container-${agentId}`,
        vnc_port: 6080 + stubState.containers.length,
        number,
        agent_type: agentType,
        agent_name: agentName,
        message_ids: [],
        agent_id: agentId,
        system_prompt: systemPrompt,
      };

      stubState.containers.push(container);
      stubState.messages.set(agentId, []);
      stubState.promptStatus.set(agentId, "stopped");
      return structuredClone(container) as T;
    }
    case "delete_agent_container": {
      const { agentId } = (args ?? {}) as { agentId: string };
      stubState.containers = stubState.containers.filter((container) => container.agent_id !== agentId);
      stubState.messages.delete(agentId);
      stubState.promptStatus.delete(agentId);
      return undefined as T;
    }
    case "update_agent_name": {
      const { agentId, newName } = (args ?? {}) as { agentId: string; newName: string };
      const container = stubState.containers.find((item) => item.agent_id === agentId);
      if (container) {
        container.agent_name = newName;
      }
      return undefined as T;
    }
    case "update_agent_system_prompt": {
      const { agentId, systemPrompt } = (args ?? {}) as { agentId: string; systemPrompt: string };
      const container = stubState.containers.find((item) => item.agent_id === agentId);
      if (container) {
        container.system_prompt = systemPrompt;
      }
      return undefined as T;
    }
    case "get_agent_messages": {
      const { agentId } = (args ?? {}) as { agentId: string };
      const messages = stubState.messages.get(agentId) ?? [];
      return structuredClone(messages) as T;
    }
    case "get_prompt_running": {
      const { agentId } = (args ?? {}) as { agentId: string };
      return (stubState.promptStatus.get(agentId) ?? "stopped") as T;
    }
    case "start_container":
      return undefined as T;
    default:
      throw new Error(`Command \"${command}\" is not available in the web preview.`);
  }
}

function structuredClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}
