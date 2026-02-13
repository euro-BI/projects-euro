import { SmartChat } from "@/components/SmartChat";
import { BackgroundVideo } from "@/components/BackgroundVideo";

const Chat = () => {
  return (
    <div className="w-full h-screen bg-transparent overflow-hidden relative">
      <BackgroundVideo videoUrl="https://rzdepoejfchewvjzojan.supabase.co/storage/v1/object/public/fotos/fotos/fotos-escudos/video-fundo.mp4" />
      <div className="relative z-10 w-full h-full">
        <SmartChat fullHeight />
      </div>
    </div>
  );
};

export default Chat;
