import { useEffect, useMemo, useRef, useState } from "react";
import {
  useConnectWallet,
  useCreateWallet,
  usePrivy,
} from "@privy-io/react-auth";
import {
  Address,
  formatUnits,
  getAddress,
  isAddress,
  isAddressEqual,
} from "viem";
import { useAccount, useBalance, useSwitchChain } from "wagmi";
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  Copy,
  ExternalLink,
  LogIn,
  LogOut,
  MessageSquare,
  MessageSquarePlus,
  QrCode,
  RefreshCcw,
  Search,
  Send,
  UserRound,
  Wallet,
} from "lucide-react";
import { StickerPicker } from "./components/StickerPicker";
import { MessageBubble } from "./components/MessageBubble";
import { QrScannerDialog } from "./components/QrScannerDialog";
import { WalletQrCode } from "./components/WalletQrCode";
import { appChain } from "./config/chains";
import { env, isConfigured } from "./config/env";
import {
  useBackgroundMessageNotifications,
  useDocumentHidden,
  type BackgroundNotificationPermission,
} from "./hooks/useBackgroundMessageNotifications";
import { useCofheConnection } from "./hooks/useCofheConnection";
import { useMailbox } from "./hooks/useMailbox";
import { CachedMessage, MessagePayload, StickerId } from "./types/messages";

const MAX_TEXT_LENGTH = 1200;
const CHAT_REFRESH_INTERVAL_MS = 10_000;
const initialParams = new URLSearchParams(window.location.search);
const initialPeer = readInitialPeer();
const initialText = (initialParams.get("text") || "").slice(0, MAX_TEXT_LENGTH);

type AppScreen = "chats" | "chat" | "profile";

type Conversation = {
  peer: Address;
  count: number;
  lastMessage: CachedMessage;
  lastSentAt: number;
};

export function App() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { connectWallet } = useConnectWallet();
  const { createWallet } = useCreateWallet();
  const { address, chainId, isConnected } = useAccount();
  const {
    switchChain,
    isPending: isSwitchingNetwork,
    error: switchNetworkError,
  } = useSwitchChain();
  const [screen, setScreen] = useState<AppScreen>(initialPeer ? "chat" : "chats");
  const [selectedPeer, setSelectedPeer] = useState<Address | undefined>(initialPeer);
  const [profilePeer, setProfilePeer] = useState<Address | undefined>(initialPeer);
  const [profileBackScreen, setProfileBackScreen] = useState<AppScreen>(
    initialPeer ? "chat" : "chats",
  );
  const [search, setSearch] = useState(() => initialPeer || "");
  const [walletNotice, setWalletNotice] = useState<string | null>(null);
  const wasAuthenticatedRef = useRef(false);
  const autoWalletCreationRef = useRef<string | null>(null);
  const allChatsRefreshInFlightRef = useRef(false);

  const isWrongNetwork = Boolean(address && chainId && chainId !== appChain.id);
  const { status: cofheStatus, error: cofheError } = useCofheConnection();
  const allMailbox = useMailbox(
    address,
    undefined,
    cofheStatus === "ready" && chainId === appChain.id,
  );
  const isDocumentHidden = useDocumentHidden();
  const backgroundNotifications = useBackgroundMessageNotifications({
    account: address,
    enabled: Boolean(ready && authenticated && address && chainId === appChain.id && isConfigured),
    messages: allMailbox.messages,
    onOpenPeer: openChat,
    refreshCount: allMailbox.refreshCount,
  });
  const shouldRefreshAllChats = screen === "chats" || isDocumentHidden;

  useEffect(() => {
    if (wasAuthenticatedRef.current && !authenticated) {
      setScreen("chats");
      setSelectedPeer(undefined);
      setProfilePeer(undefined);
      setProfileBackScreen("chats");
      setWalletNotice(null);
      autoWalletCreationRef.current = null;
    }
    wasAuthenticatedRef.current = authenticated;
  }, [authenticated]);

  useEffect(() => {
    if (address) setWalletNotice(null);
  }, [address]);

  useEffect(() => {
    if (!address || chainId !== appChain.id || !isConfigured) return;
    void allMailbox.refresh();
  }, [address, allMailbox.refresh, chainId]);

  useEffect(() => {
    if (!shouldRefreshAllChats || !address || chainId !== appChain.id || !isConfigured) return;

    const refreshAllChats = async () => {
      if (allChatsRefreshInFlightRef.current) return;
      allChatsRefreshInFlightRef.current = true;
      try {
        await allMailbox.refresh();
      } finally {
        allChatsRefreshInFlightRef.current = false;
      }
    };

    if (isDocumentHidden) void refreshAllChats();

    const intervalId = window.setInterval(() => {
      void refreshAllChats();
    }, CHAT_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [address, allMailbox.refresh, chainId, isDocumentHidden, shouldRefreshAllChats]);

  const conversations = useMemo(
    () => (address ? buildConversations(address, allMailbox.messages) : []),
    [address, allMailbox.messages],
  );

  function requestNetworkSwitch() {
    switchChain({ chainId: appChain.id });
  }

  async function handleCreateWallet(isAutomatic = false) {
    setWalletNotice(isAutomatic ? "Creating your wallet automatically..." : "Creating wallet...");
    try {
      await createWallet();
      setWalletNotice("Wallet created. Connecting...");
    } catch (walletError) {
      setWalletNotice(
        walletError instanceof Error ? walletError.message : "Could not create wallet.",
      );
    }
  }

  useEffect(() => {
    if (!ready || !authenticated || address || !env.privyAppId) return;

    const userKey = user?.id || user?.email?.address || user?.google?.email || "authenticated";
    if (autoWalletCreationRef.current === userKey) return;

    autoWalletCreationRef.current = userKey;
    void handleCreateWallet(true);
  }, [
    address,
    authenticated,
    ready,
    user?.email?.address,
    user?.google?.email,
    user?.id,
  ]);

  function openChat(peer: Address) {
    setSelectedPeer(peer);
    setProfilePeer(peer);
    setScreen("chat");
  }

  function openProfile(peer: Address) {
    setProfilePeer(peer);
    setProfileBackScreen(screen === "chat" ? "chat" : "chats");
    setScreen("profile");
  }

  const needsAuthGate = !ready || !authenticated || !address;

  return (
    <main className="desktop-shell">
      <section className="window app-window">
        <header className="title-bar">
          <div className="title-wrap">
            <span className="app-glyph">B</span>
            <span>Blackout Messenger</span>
          </div>
          <div className="window-buttons" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </header>

        {needsAuthGate ? (
          <AuthScreen
            ready={ready}
            authenticated={authenticated}
            address={address}
            chainId={chainId}
            isConnected={isConnected}
            isWrongNetwork={isWrongNetwork}
            isSwitchingNetwork={isSwitchingNetwork}
            switchNetworkError={switchNetworkError?.message || null}
            email={user?.email?.address || user?.google?.email}
            walletNotice={walletNotice}
            onLogin={login}
            onLogout={() => void logout()}
            onCreateWallet={() => void handleCreateWallet()}
            onConnectWallet={() => connectWallet()}
            onSwitchNetwork={requestNetworkSwitch}
          />
        ) : screen === "chat" && selectedPeer ? (
          <ChatScreen
            ready={ready}
            authenticated={authenticated}
            account={address}
            chainId={chainId}
            cofheStatus={cofheStatus}
            cofheError={cofheError}
            peer={selectedPeer}
            onBack={() => setScreen("chats")}
            onOpenProfile={() => openProfile(selectedPeer)}
            onSent={() => void allMailbox.refresh()}
            notificationPermission={backgroundNotifications.permission}
            onRequestNotifications={() => void backgroundNotifications.requestPermission()}
          />
        ) : screen === "profile" && profilePeer ? (
          <ProfileScreen
            account={address}
            peer={profilePeer}
            messages={allMailbox.messages}
            onBack={() =>
              setScreen(profileBackScreen === "chat" && selectedPeer ? "chat" : "chats")
            }
            onOpenChat={
              isAddressEqual(address, profilePeer) ? undefined : () => openChat(profilePeer)
            }
          />
        ) : (
          <ChatListScreen
            account={address}
            chainId={chainId}
            email={user?.email?.address || user?.google?.email}
            conversations={conversations}
            search={search}
            loading={allMailbox.loading}
            error={allMailbox.error || cofheError}
            isWrongNetwork={isWrongNetwork}
            isSwitchingNetwork={isSwitchingNetwork}
            switchNetworkError={switchNetworkError?.message || null}
            onSearchChange={setSearch}
            onStartChat={openChat}
            onOpenProfile={openProfile}
            onOpenOwnProfile={() => openProfile(address)}
            onRefresh={() => void allMailbox.refresh()}
            onLogout={() => void logout()}
            onSwitchNetwork={requestNetworkSwitch}
            notificationPermission={backgroundNotifications.permission}
            onRequestNotifications={() => void backgroundNotifications.requestPermission()}
          />
        )}
      </section>
    </main>
  );
}

function AuthScreen({
  ready,
  authenticated,
  address,
  chainId,
  isConnected,
  isWrongNetwork,
  isSwitchingNetwork,
  switchNetworkError,
  email,
  walletNotice,
  onLogin,
  onLogout,
  onCreateWallet,
  onConnectWallet,
  onSwitchNetwork,
}: {
  ready: boolean;
  authenticated: boolean;
  address?: Address;
  chainId?: number;
  isConnected: boolean;
  isWrongNetwork: boolean;
  isSwitchingNetwork: boolean;
  switchNetworkError: string | null;
  email?: string;
  walletNotice: string | null;
  onLogin: () => void;
  onLogout: () => void;
  onCreateWallet: () => void;
  onConnectWallet: () => void;
  onSwitchNetwork: () => void;
}) {
  const needsWallet = authenticated && !address;

  return (
    <div className="screen-body auth-body">
      <section className="auth-panel">
        <div className="panel-title">AUTHORIZATION</div>
        <div className="auth-copy">
          <h1>{needsWallet ? "Connect a wallet" : "Enter Blackout"}</h1>
          <p>
            {needsWallet
              ? "Email confirmed. Create or connect a wallet to open your chats."
              : "Log in with email or wallet to open your chats."}
          </p>
        </div>

        <div className="auth-actions">
          {needsWallet ? (
            <button
              className="primary-action"
              onClick={onCreateWallet}
              disabled={!ready || !env.privyAppId}
              title="Create an embedded wallet"
            >
              <Wallet size={18} />
              Create wallet
            </button>
          ) : (
            <button
              className="primary-action"
              onClick={onLogin}
              disabled={!ready || !env.privyAppId}
              title="Log in or register"
            >
              <LogIn size={18} />
              Log in or sign up
            </button>
          )}
          {authenticated ? (
            <button className="retro-button" onClick={onLogout} title="Log out">
              <LogOut size={16} />
              Log out
            </button>
          ) : null}
          {needsWallet ? (
            <button className="retro-button" onClick={onConnectWallet} title="Connect wallet">
              <Wallet size={16} />
              Connect external wallet
            </button>
          ) : null}
        </div>
        {walletNotice ? <div className="setup-box">{walletNotice}</div> : null}
      </section>

      <aside className="network-panel">
        <div className="panel-title">NETWORK</div>
        <div className="identity-box">
          <div>Required network</div>
          <strong>{appChain.name}</strong>
          <div>{address ? `Current chain: ${chainId || "?"}` : "Wallet not connected yet"}</div>
        </div>
        <button
          className="retro-button"
          type="button"
          onClick={onSwitchNetwork}
          disabled={!isConnected || !address || !isWrongNetwork || isSwitchingNetwork}
          title={`Switch wallet to ${appChain.name}`}
        >
          <Wallet size={16} />
          Switch to {appChain.name}
        </button>
        {email || address ? (
          <div className="identity-box">
            <div>Session</div>
            <strong>{address ? shortAddress(address) : "waiting for wallet"}</strong>
            <div>{email || "wallet login"}</div>
          </div>
        ) : null}
        {!isConfigured ? (
          <div className="setup-box">
            <strong>Setup needed</strong>
            <span>Fill Privy app id and deployed contract address in .env.</span>
          </div>
        ) : null}
        {switchNetworkError ? <p className="error-text">{switchNetworkError}</p> : null}
      </aside>
    </div>
  );
}

function NotificationButton({
  permission,
  onRequestPermission,
}: {
  permission: BackgroundNotificationPermission;
  onRequestPermission: () => void;
}) {
  const isEnabled = permission === "granted";
  const isDenied = permission === "denied";
  const isUnsupported = permission === "unsupported";
  const title = notificationPermissionTitle(permission);
  const Icon = isDenied || isUnsupported ? BellOff : Bell;
  const stateClass = isEnabled ? " success" : isDenied ? " danger" : "";

  return (
    <button
      className={`icon-button${stateClass}`}
      type="button"
      onClick={onRequestPermission}
      disabled={isEnabled || isDenied || isUnsupported}
      title={title}
      aria-label={title}
    >
      <Icon size={16} />
    </button>
  );
}

function ChatListScreen({
  account,
  chainId,
  email,
  conversations,
  search,
  loading,
  error,
  isWrongNetwork,
  isSwitchingNetwork,
  switchNetworkError,
  onSearchChange,
  onStartChat,
  onOpenProfile,
  onOpenOwnProfile,
  onRefresh,
  onLogout,
  onSwitchNetwork,
  notificationPermission,
  onRequestNotifications,
}: {
  account: Address;
  chainId?: number;
  email?: string;
  conversations: Conversation[];
  search: string;
  loading: boolean;
  error?: string | null;
  isWrongNetwork: boolean;
  isSwitchingNetwork: boolean;
  switchNetworkError: string | null;
  onSearchChange: (value: string) => void;
  onStartChat: (peer: Address) => void;
  onOpenProfile: (peer: Address) => void;
  onOpenOwnProfile: () => void;
  onRefresh: () => void;
  onLogout: () => void;
  onSwitchNetwork: () => void;
  notificationPermission: BackgroundNotificationPermission;
  onRequestNotifications: () => void;
}) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const trimmedSearch = search.trim();
  const searchAddress = isAddress(trimmedSearch) ? getAddress(trimmedSearch) : undefined;
  const filteredConversations = conversations.filter((conversation) =>
    conversation.peer.toLowerCase().includes(trimmedSearch.toLowerCase()),
  );
  const hasConversationForSearch = Boolean(
    searchAddress &&
      conversations.some((conversation) => isAddressEqual(conversation.peer, searchAddress)),
  );

  return (
    <div className="screen-body">
      <header className="screen-header chats-header">
        <div>
          <span className="eyebrow">Chats</span>
          <h1>All conversations</h1>
          <p>{email || shortAddress(account)}</p>
        </div>
        <div className="header-actions chats-actions">
          <button
            className="icon-button"
            onClick={onOpenOwnProfile}
            title="Open my profile"
            aria-label="Open my profile"
          >
            <UserRound size={16} />
          </button>
          <NotificationButton
            permission={notificationPermission}
            onRequestPermission={onRequestNotifications}
          />
          <button
            className="icon-button"
            onClick={onRefresh}
            disabled={loading || chainId !== appChain.id}
            title="Refresh chain mailbox"
            aria-label="Refresh chain mailbox"
          >
            <RefreshCcw size={16} />
          </button>
          <button
            className="icon-button danger"
            onClick={onLogout}
            title="Log out"
            aria-label="Log out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {isWrongNetwork ? (
        <div className="network-box" role="alert">
          <div className="network-box-title">
            <AlertTriangle size={16} />
            {appChain.name} required
          </div>
          <button
            className="retro-button"
            type="button"
            onClick={onSwitchNetwork}
            disabled={isSwitchingNetwork}
          >
            <Wallet size={16} />
            Switch network
          </button>
          {switchNetworkError ? <span className="error-text">{switchNetworkError}</span> : null}
        </div>
      ) : null}

      <section className="chat-list-shell">
        <div className="search-row">
          <Search size={17} aria-hidden="true" />
          <input
            className="retro-input"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search or paste a 0x address..."
            spellCheck={false}
          />
          <button
            className="icon-button"
            type="button"
            onClick={() => setScannerOpen(true)}
            title="Scan a wallet QR code"
            aria-label="Scan a wallet QR code"
          >
            <QrCode size={16} />
          </button>
        </div>

        <div className="chat-list">
          {filteredConversations.length ? (
            filteredConversations.map((conversation) => (
              <article className="chat-row" key={conversation.peer}>
                <button
                  className="chat-row-main"
                  type="button"
                  onClick={() => onStartChat(conversation.peer)}
                >
                  <MessageSquare size={18} />
                  <span>
                    <strong>{shortAddress(conversation.peer)}</strong>
                    <small>{conversation.count} messages</small>
                  </span>
                  <time>{formatTime(conversation.lastSentAt)}</time>
                </button>
                <button
                  className="icon-button"
                  type="button"
                  onClick={() => onOpenProfile(conversation.peer)}
                  title="Open profile"
                >
                  <UserRound size={17} />
                </button>
              </article>
            ))
          ) : (
            <div className="empty-state">
              <MessageSquarePlus size={30} />
              <span>{conversations.length ? "No matches." : "No chats yet."}</span>
            </div>
          )}
        </div>

        {searchAddress && !hasConversationForSearch ? (
          <div className="start-chat-strip">
            <span>Address is not in your history: {shortAddress(searchAddress)}</span>
            <button className="send-button" type="button" onClick={() => onStartChat(searchAddress)}>
              <MessageSquarePlus size={17} />
              Start chat
            </button>
          </div>
        ) : !conversations.length ? (
          <div className="start-chat-strip">
            <span>Paste a recipient address into search to start a conversation.</span>
          </div>
        ) : null}
      </section>

      <div className="notice-strip">{error || (loading ? "Loading messages..." : "Ready.")}</div>

      {scannerOpen ? (
        <QrScannerDialog
          onClose={() => setScannerOpen(false)}
          onScanAddress={(walletAddress) => {
            setScannerOpen(false);
            onStartChat(walletAddress);
          }}
        />
      ) : null}
    </div>
  );
}

function ChatScreen({
  ready,
  authenticated,
  account,
  chainId,
  cofheStatus,
  cofheError,
  peer,
  onBack,
  onOpenProfile,
  onSent,
  notificationPermission,
  onRequestNotifications,
}: {
  ready: boolean;
  authenticated: boolean;
  account: Address;
  chainId?: number;
  cofheStatus: string;
  cofheError: string | null;
  peer: Address;
  onBack: () => void;
  onOpenProfile: () => void;
  onSent: () => void;
  notificationPermission: BackgroundNotificationPermission;
  onRequestNotifications: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [selectedSticker, setSelectedSticker] = useState<StickerId>();
  const [localNotice, setLocalNotice] = useState<string | null>(null);
  const [decryptingIds, setDecryptingIds] = useState<Set<string>>(() => new Set());
  const autoRefreshInFlightRef = useRef(false);
  const decryptingRef = useRef(new Set<string>());
  const attemptedDecryptRef = useRef(new Set<string>());
  const mailbox = useMailbox(account, peer, cofheStatus === "ready" && chainId === appChain.id);

  useEffect(() => {
    if (chainId !== appChain.id || !isConfigured) return;
    void mailbox.refresh();
  }, [chainId, mailbox.refresh, peer]);

  useEffect(() => {
    if (chainId !== appChain.id || !isConfigured) return;

    const refreshChat = async () => {
      if (autoRefreshInFlightRef.current) return;
      autoRefreshInFlightRef.current = true;
      try {
        await mailbox.refresh();
      } finally {
        autoRefreshInFlightRef.current = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshChat();
    }, CHAT_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [chainId, mailbox.refresh, peer]);

  useEffect(() => {
    if (cofheStatus !== "ready") return;

    const encryptedMessages = mailbox.messages.filter((message) => {
      const id = message.id.toString();
      return (
        !message.payload &&
        !message.decryptError &&
        !decryptingRef.current.has(id) &&
        !attemptedDecryptRef.current.has(id)
      );
    });

    encryptedMessages.forEach((message) => {
      const id = message.id.toString();
      decryptingRef.current.add(id);
      attemptedDecryptRef.current.add(id);
      setDecryptingIds((current) => new Set(current).add(id));
      void mailbox.decryptMessage(message.id).finally(() => {
        decryptingRef.current.delete(id);
        setDecryptingIds((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
      });
    });
  }, [cofheStatus, mailbox.decryptMessage, mailbox.messages]);

  const sendBlocker = getSendBlocker({
    ready,
    authenticated,
    address: account,
    normalizedPeer: peer,
    isConfigured,
    cofheStatus,
    chainId,
    hasPayload: Boolean(text.trim() || selectedSticker),
  });
  const canSend = !sendBlocker;

  async function handleSend() {
    const trimmedText = text.trim();
    const payload: MessagePayload = selectedSticker
      ? trimmedText
        ? {
            version: 1,
            type: "mixed",
            text: trimmedText,
            stickerId: selectedSticker,
          }
        : {
            version: 1,
            type: "sticker",
            stickerId: selectedSticker,
          }
      : {
          version: 1,
          type: "text",
          text: trimmedText,
        };

    try {
      await mailbox.sendMessage(peer, payload);
      setText("");
      setSelectedSticker(undefined);
      setLocalNotice(null);
      onSent();
    } catch (sendError) {
      setLocalNotice(sendError instanceof Error ? sendError.message : "Send failed.");
    }
  }

  return (
    <div className="screen-body chat-screen">
      <header className="thread-header">
        <button className="icon-button" type="button" onClick={onBack} title="Back to chats">
          <ArrowLeft size={18} />
        </button>
        <div className="thread-title">
          <span className="eyebrow">Encrypted chat</span>
          <h1>{shortAddress(peer)}</h1>
        </div>
        <div className="thread-actions">
          <NotificationButton
            permission={notificationPermission}
            onRequestPermission={onRequestNotifications}
          />
          <button className="retro-button" type="button" onClick={onOpenProfile}>
            <UserRound size={16} />
            Profile
          </button>
        </div>
      </header>

      <div className="message-list" aria-live="polite">
        {mailbox.messages.length ? (
          mailbox.messages.map((message) => (
            <MessageBubble
              key={message.id.toString()}
              message={message}
              account={account}
              decryptDisabled={cofheStatus !== "ready"}
              decrypting={decryptingIds.has(message.id.toString())}
              onDecrypt={(messageId) => void mailbox.decryptMessage(messageId)}
            />
          ))
        ) : (
          <div className="empty-state">
            <MessageSquarePlus size={28} />
            <span>No messages yet.</span>
          </div>
        )}
      </div>

      <form
        className="compose"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSend();
        }}
      >
        <StickerPicker selected={selectedSticker} onSelect={setSelectedSticker} />
        <textarea
          className="retro-textarea"
          value={text}
          onChange={(event) => setText(event.target.value.slice(0, MAX_TEXT_LENGTH))}
          placeholder="Message..."
        />
        <div className="compose-actions">
          <span>{MAX_TEXT_LENGTH - text.length} chars</span>
          <button className="send-button" type="submit" disabled={!canSend}>
            <Send size={17} />
            Send
          </button>
        </div>
      </form>

      <div className="notice-strip">
        {mailbox.error ||
          cofheError ||
          localNotice ||
          sendBlocker ||
          sendStateText(mailbox.sendState)}
      </div>
    </div>
  );
}

function ProfileScreen({
  account,
  peer,
  messages,
  onBack,
  onOpenChat,
}: {
  account: Address;
  peer: Address;
  messages: CachedMessage[];
  onBack: () => void;
  onOpenChat?: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "selected">("idle");
  const addressInputRef = useRef<HTMLInputElement | null>(null);
  const isSelf = isAddressEqual(account, peer);
  const balance = useBalance({
    address: peer,
    chainId: appChain.id,
  });
  const peerMessages = useMemo(
    () => {
      if (isSelf) return messages;
      return messages.filter(
        (message) =>
          (isAddressEqual(message.sender, account) && isAddressEqual(message.recipient, peer)) ||
          (isAddressEqual(message.sender, peer) && isAddressEqual(message.recipient, account)),
      );
    },
    [account, isSelf, messages, peer],
  );
  const explorerUrl = `${appChain.blockExplorers?.default.url || ""}/address/${peer}`;

  async function copyAddress() {
    try {
      await copyText(peer);
      setCopyState("copied");
    } catch {
      addressInputRef.current?.focus();
      addressInputRef.current?.select();
      setCopyState("selected");
    }
    window.setTimeout(() => setCopyState("idle"), 1600);
  }

  return (
    <div className="screen-body profile-screen">
      <header className="screen-header">
        <button className="icon-button" type="button" onClick={onBack} title="Back">
          <ArrowLeft size={18} />
        </button>
        <div>
          <span className="eyebrow">Profile</span>
          <h1>{isSelf ? "My profile" : shortAddress(peer)}</h1>
        </div>
        {onOpenChat ? (
          <button className="retro-button" type="button" onClick={onOpenChat}>
            <MessageSquare size={16} />
            Chat
          </button>
        ) : null}
      </header>

      <section className="profile-grid">
        <div className="profile-address-panel">
          <div className="panel-title">WALLET ADDRESS</div>
          <input
            aria-label="Wallet address"
            className="address-readout"
            readOnly
            ref={addressInputRef}
            value={peer}
          />
          <div className="profile-actions">
            <button className="retro-button" type="button" onClick={copyAddress}>
              {copyState === "idle" ? <Copy size={16} /> : <Check size={16} />}
              {copyState === "copied"
                ? "Copied"
                : copyState === "selected"
                  ? "Selected"
                  : "Copy address"}
            </button>
            <a className="scan-link" href={explorerUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={17} />
              Open in explorer
            </a>
          </div>
        </div>

        <div className="profile-qr-panel">
          <div className="panel-title">WALLET QR</div>
          <WalletQrCode value={peer} />
        </div>

        <div className="metric-box">
          <span>Messages</span>
          <strong>{peerMessages.length}</strong>
        </div>
        <div className="metric-box">
          <span>Balance</span>
          <strong>{balance.data ? formatBalance(balance.data) : balance.isLoading ? "..." : "0"}</strong>
          <small>{balance.data?.symbol || appChain.nativeCurrency.symbol}</small>
        </div>
      </section>
    </div>
  );
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, value.length);

    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (!copied) throw new Error("Copy failed.");
  }
}

function buildConversations(account: Address, messages: CachedMessage[]): Conversation[] {
  const conversationsByPeer = new Map<string, Conversation>();

  messages.forEach((message) => {
    const peer = isAddressEqual(message.sender, account) ? message.recipient : message.sender;
    const key = peer.toLowerCase();
    const existing = conversationsByPeer.get(key);

    if (!existing) {
      conversationsByPeer.set(key, {
        peer,
        count: 1,
        lastMessage: message,
        lastSentAt: message.sentAt,
      });
      return;
    }

    existing.count += 1;
    if (message.sentAt >= existing.lastSentAt) {
      existing.lastMessage = message;
      existing.lastSentAt = message.sentAt;
    }
  });

  return [...conversationsByPeer.values()].sort((left, right) => {
    if (right.lastSentAt !== left.lastSentAt) return right.lastSentAt - left.lastSentAt;
    return Number(right.lastMessage.id - left.lastMessage.id);
  });
}

function readInitialPeer() {
  const peer = initialParams.get("peer") || "";
  return isAddress(peer) ? getAddress(peer) : undefined;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTime(timestamp: number) {
  if (!timestamp) return "--:--";
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp * 1000));
}

function formatBalance(balance: {
  value: bigint;
  decimals: number;
  symbol: string;
}) {
  const [whole, fraction = ""] = formatUnits(balance.value, balance.decimals).split(".");
  const trimmedFraction = fraction.slice(0, 6).replace(/0+$/, "");
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole;
}

function notificationPermissionTitle(permission: BackgroundNotificationPermission) {
  if (permission === "granted") return "Background notifications enabled";
  if (permission === "denied") return "Notifications are blocked in this browser";
  if (permission === "unsupported") return "Browser notifications unavailable";
  return "Enable background notifications";
}

function sendStateText(state: string) {
  if (state === "encrypting") return "Encrypting body and Fhenix key chunks...";
  if (state === "submitting") return "Submitting encrypted packet to testnet...";
  if (state === "confirming") return "Waiting for block confirmation...";
  if (state === "done") return "Message dropped on-chain.";
  if (state === "error") return "Send failed.";
  return "Ready.";
}

function getSendBlocker({
  ready,
  authenticated,
  address,
  normalizedPeer,
  isConfigured,
  cofheStatus,
  chainId,
  hasPayload,
}: {
  ready: boolean;
  authenticated: boolean;
  address?: Address;
  normalizedPeer?: Address;
  isConfigured: boolean;
  cofheStatus: string;
  chainId?: number;
  hasPayload: boolean;
}) {
  if (!ready) return "Loading Privy session...";
  if (!authenticated || !address) return "Login first so the app has a sender wallet.";
  if (!isConfigured) return "Contract address is missing in .env.";
  if (chainId !== appChain.id) return `Switch wallet network to ${appChain.name}.`;
  if (cofheStatus !== "ready") return "Waiting for Fhenix connection.";
  if (!normalizedPeer) return "Paste a valid recipient wallet address.";
  if (!hasPayload) return "Type a message or pick a sticker.";
  return null;
}
