import type { EncodingOptions } from '~/legacy/modules/video/add-video/add-video.types';
import { EncodingOptionsComponent } from '~/legacy/components/EncodingOptions';

interface AddVideosEncodingOptionsProps {
  value: EncodingOptions;
  onChange: (options: EncodingOptions) => void;
  fileSize?: number;
}

export function AddVideosEncodingOptions({
  value,
  onChange,
  fileSize,
}: AddVideosEncodingOptionsProps) {
  return (
    <EncodingOptionsComponent
      fileSize={fileSize}
      onChange={onChange}
      value={value}
    />
  );
}
