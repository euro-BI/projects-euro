
interface BackgroundVideoProps {
  videoUrl?: string;
  opacity?: string;
}

export const BackgroundVideo = ({ 
  videoUrl = "https://rzdepoejfchewvjzojan.supabase.co/storage/v1/object/public/fotos/fotos/fotos-escudos/login.mp4",
  opacity = "opacity-30"
}: BackgroundVideoProps) => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
      <video
        autoPlay
        muted
        loop
        playsInline
        className={`absolute min-w-full min-h-full object-cover ${opacity}`}
      >
        <source
          src={videoUrl}
          type="video/mp4"
        />
        Your browser does not support the video tag.
      </video>
      <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px]" />
    </div>
  );
};
