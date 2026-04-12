import { SmartChat } from "@/components/SmartChat";

const Chat = () => {
  return (
    <div className="w-full h-screen bg-transparent overflow-hidden relative">
      <div className="relative z-10 w-full h-full">
        <SmartChat fullHeight />
      </div>
    </div>
  );
};

export default Chat;
