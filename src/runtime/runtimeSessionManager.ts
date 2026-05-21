import { RuntimeState } from "./runtimeConstraints";
import {
  RuntimeConversationContext,
  RuntimePersonaForPrompt,
  RuntimePromptBundle,
  buildRuntimePrompt
} from "./runtimePromptBuilder";

export interface RuntimeSessionInput {
  runtime_persona_id: string;
  runtime_state: RuntimeState;
  active_constraints: string[];
  conversation_context: RuntimeConversationContext;
}

export class RuntimeSessionManager {
  private readonly persona: RuntimePersonaForPrompt;
  private state: RuntimeState;
  private activeConstraints: string[];
  private context: RuntimeConversationContext;

  constructor(persona: RuntimePersonaForPrompt, input: RuntimeSessionInput) {
    this.persona = persona;
    this.state = input.runtime_state;
    this.activeConstraints = [...input.active_constraints];
    this.context = { ...input.conversation_context };
  }

  public getRuntimePrompt(): RuntimePromptBundle {
    return buildRuntimePrompt(
      this.persona,
      this.state,
      this.activeConstraints,
      this.context
    );
  }

  public appendUserMessage(text: string): void {
    this.context.recent_messages = [...this.context.recent_messages, text].slice(-8);
  }

  public setState(next: RuntimeState): void {
    this.state = next;
    this.context.current_phase = next;
  }

  public addConstraint(line: string): void {
    this.activeConstraints.push(line);
  }
}
