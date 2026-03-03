import { SmartChat } from "@/components/SmartChat";
import { BackgroundVideo } from "@/components/BackgroundVideo";

const Chat = () => {
  return (
    <div className="w-full h-screen bg-transparent overflow-hidden relative">
      <BackgroundVideo videoUrl="https://pub-b2b30f370a3947899854a061170643ea.r2.dev/utils/video-fundo.mp4" />
      <div className="relative z-10 w-full h-full">
        <SmartChat fullHeight />
      </div>
    </div>
  );
};

export default Chat;
