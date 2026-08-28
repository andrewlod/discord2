import { cn } from '@/utils';
import { getColorFromString } from '@/utils';

interface ServerIconProps {
  server: { id: string; name: string; icon_url?: string };
  size?: number;
  className?: string;
}

export default function ServerIcon({ server, size = 40, className = '' }: ServerIconProps) {
  const { icon_url, name, id } = server;
  const color = getColorFromString(id);

  if (icon_url) {
    return (
      <img
        src={icon_url}
        alt={name}
        className={cn('rounded-lg object-cover', className)}
        width={size}
        height={size}
      />
    );
  }

  return (
    <div
      className={cn('rounded-lg flex items-center justify-center font-bold select-none', className)}
      style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.4 }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}