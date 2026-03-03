
interface BackgroundVideoProps {
  videoUrl?: string;
  opacity?: string;
}

export const BackgroundVideo = ({ 
  videoUrl = "https://pub-b2b30f370a3947899854a061170643ea.r2.dev/utils/login.mp4",
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
