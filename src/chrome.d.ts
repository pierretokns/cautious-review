// Deliberately small declaration of the Chrome API surface this preview uses.
interface MessageSender { id?: string; url?: string; frameId?: number; tab?: { id?: number } }
interface ChromeTab { id?: number; url?: string }
declare const chrome: {
  tabs: { create(options: {url:string}): Promise<unknown>; get(tabId:number): Promise<ChromeTab> };
  runtime: {
    id: string;
    getURL(path: string): string;
    sendMessage(message: unknown): Promise<any>;
    onMessage: { addListener(listener: (message: any, sender: MessageSender, respond: (response: unknown) => void) => boolean): void };
  };
};
