import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistance, parseISO } from "date-fns";
import { ChatMessage } from "@shared/schema";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../hooks/use-auth";

interface ChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listingId: number;
  recipientId: number;
}

export default function ChatDialog({ open, onOpenChange, listingId, recipientId }: ChatDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !user) return;

    try {
      // Get the current hostname and port
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const { hostname, port } = window.location;
      const wsPort = port || "5000"; // Fallback to 5000 if port is empty
      const wsUrl = `${wsProtocol}//${hostname}:${wsPort}/ws`;
      console.log('Attempting WebSocket connection to:', wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected successfully');
        setIsConnecting(false);
        setConnectionError(null);
        
        // Authenticate the connection
        ws.send(JSON.stringify({
          type: 'auth',
          data: { 
            userId: user.id,
            token: localStorage.getItem('auth_token') // Send token for authentication
          }
        }));

        // Load existing messages
        fetch(`/api/listings/${listingId}/messages`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          }
        })
          .then(res => {
            if (!res.ok) {
              throw new Error(`HTTP error! Status: ${res.status}`);
            }
            return res.json();
          })
          .then(data => setMessages(data))
          .catch(error => {
            console.error('Error loading messages:', error);
            toast({
              title: "Error loading messages",
              description: "Failed to load chat history",
              variant: "destructive",
            });
          });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chat') {
            setMessages(prev => [...prev, data.data]);
          } else if (data.type === 'error') {
            console.error('Server error:', data.message);
            toast({
              title: "Server Error",
              description: data.message || "An error occurred",
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        console.log('Connection details:', { wsUrl, readyState: ws.readyState });
        setIsConnecting(false);
        setConnectionError("Failed to connect to chat server");
        toast({
          title: "Connection error",
          description: "Failed to connect to chat server. Please try again later.",
          variant: "destructive",
        });
      };

      ws.onclose = (event) => {
        console.log('WebSocket connection closed', event.code, event.reason);
        setIsConnecting(false);
        
        if (event.code !== 1000) { // 1000 is normal closure
          setConnectionError("Connection closed unexpectedly");
          toast({
            title: "Connection closed",
            description: "Chat connection was closed. Please refresh to reconnect.",
            variant: "destructive",
          });
        }
      };

      setSocket(ws);

      return () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      };
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
      setIsConnecting(false);
      setConnectionError("Failed to initialize chat connection");
      toast({
        title: "Connection error",
        description: "Failed to initialize chat connection",
        variant: "destructive",
      });
    }
  }, [open, user, listingId, toast]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!socket || !message.trim() || !user) return;

    // Check socket state
    if (socket.readyState !== WebSocket.OPEN) {
      toast({
        title: "Connection lost",
        description: "Please refresh the page to reconnect",
        variant: "destructive",
      });
      return;
    }

    const messageData = {
      type: 'chat',
      data: {
        message: message.trim(),
        listingId,
        senderId: user.id,
        recipientId,
        createdAt: new Date().toISOString() // Add client timestamp for immediate display
      }
    };

    try {
      socket.send(JSON.stringify(messageData));
      
      setMessage("");
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const reconnect = () => {
    setIsConnecting(true);
    setConnectionError(null);
    // Force the useEffect to run again by changing a dependency
    onOpenChange(false);
    setTimeout(() => onOpenChange(true), 100);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Chat</DialogTitle>
          <DialogDescription>
            Communicate with other users about this listing
          </DialogDescription>
        </DialogHeader>
        
        {isConnecting ? (
          <div className="h-[300px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : connectionError ? (
          <div className="h-[300px] flex flex-col items-center justify-center gap-4">
            <p className="text-destructive">{connectionError}</p>
            <Button onClick={reconnect}>Try Again</Button>
          </div>
        ) : (
          <>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-4">
                {messages.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    No messages yet. Start the conversation!
                  </p>
                ) : (
                  messages.map((msg, idx) => (
                    <div
                      key={msg.id || idx}
                      className={`flex ${msg.senderId === user?.id ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                          msg.senderId === user?.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm">{msg.message}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {formatDistance(parseISO(msg.createdAt + 'Z'), new Date(), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
            <div className="flex gap-2">
              <Input
                placeholder="Type your message..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <Button size="icon" onClick={handleSend} disabled={!message.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
