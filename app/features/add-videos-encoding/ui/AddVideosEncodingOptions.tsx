import type { AddVideosEncodingOptions as AddVideosEncodingOptionsValue } from '~/features/add-videos-encoding/model/add-videos-encoding-options';
import type { EncodingOptions as LegacyEncodingOptions } from '~/legacy/modules/video/add-video/add-video.types';
import { EncodingOptionsComponent } from '~/legacy/components/EncodingOptions';

interface AddVideosEncodingOptionsProps {
  value: AddVideosEncodingOptionsValue;
  onChange: (options: AddVideosEncodingOptionsValue) => void;
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
      onChange={options => onChange(options as AddVideosEncodingOptionsValue)}
      value={value as LegacyEncodingOptions}
    />
  );
}
