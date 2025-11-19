import React, { useState } from "react";

interface ChatWidgetProps {
  className?: string;
  style?: React.CSSProperties;
}

const ChatWidget: React.FC<ChatWidgetProps> = ({
  className = "",
  style = {},
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  const defaultStyle: React.CSSProperties = {
    height: "100%",
    minHeight: "700px",
    border: "none",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.1)",
    ...style,
  };

  return (
    <div className={`chat-widget ${className}`}>
      {!isLoaded && (
        <div
          style={{
            textAlign: "center",
            padding: "20px",
            background: "#f5f5f5",
            borderRadius: "8px",
          }}
        >
          Loading chatbot...
        </div>
      )}
      <iframe
        src="https://www.chatbase.co/chatbot-iframe/wmcsMgHN0D0nc84tgnAv_"
        width="100%"
        style={defaultStyle}
        title="Chatbase Chatbot"
        allow="microphone"
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  );
};

export default ChatWidget;
