// Deliberately small declaration of the Chrome API surface this preview uses.
interface MessageSender { id?: string; url?: string; frameId?: number; tab?: { id?: number } }
declare const chrome: {
  tabs: { create(options: {url:string}): Promise<unknown> };
  runtime: {
    id: string;
    getURL(path: string): string;
    sendMessage(message: unknown): Promise<any>;
    onMessage: { addListener(listener: (message: any, sender: MessageSender, respond: (response: unknown) => void) => boolean): void };
  };
};
