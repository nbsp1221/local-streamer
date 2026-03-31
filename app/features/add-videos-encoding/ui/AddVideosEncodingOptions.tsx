import { useId } from 'react';
import { ADD_VIDEOS_ENCODING_OPTION_METADATA } from '~/features/add-videos-encoding/model/add-videos-encoding-option-metadata';
import { type AddVideosEncoder, type AddVideosEncodingOptions as AddVideosEncodingOptionsValue } from '~/features/add-videos-encoding/model/add-videos-encoding-options';
import { cn } from '~/shared/lib/utils';
import { Badge } from '~/shared/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/shared/ui/card';
import { Label } from '~/shared/ui/label';

interface AddVideosEncodingOptionsProps {
  value: AddVideosEncodingOptionsValue;
  onChange: (options: AddVideosEncodingOptionsValue) => void;
}

export function AddVideosEncodingOptions({
  value,
  onChange,
}: AddVideosEncodingOptionsProps) {
  const instanceId = useId();

  const handleEncoderChange = (encoder: AddVideosEncoder) => {
    onChange({ encoder });
  };

  return (
    <Card>
      <CardHeader className="gap-1 pb-3">
        <CardTitle className="text-lg">Browser Playback Encoding</CardTitle>
        <CardDescription>
          Choose the encoder to use when this upload is added to the library.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <fieldset
          aria-label="Encoding options"
          className="grid gap-3 md:grid-cols-2"
        >
          {ADD_VIDEOS_ENCODING_OPTION_METADATA.map((option) => {
            const inputId = `${instanceId}-${option.value}`;
            const isSelected = value.encoder === option.value;
            const detailId = `${inputId}-detail`;
            const radioName = `add-videos-encoding-${instanceId}`;

            return (
              <div key={option.value}>
                <input
                  aria-describedby={detailId}
                  aria-label={option.label}
                  checked={isSelected}
                  className="peer sr-only"
                  id={inputId}
                  name={radioName}
                  onChange={() => handleEncoderChange(option.value)}
                  type="radio"
                  value={option.value}
                />
                <Label
                  className={cn(
                    'flex cursor-pointer flex-col items-start gap-2 rounded-lg border p-4 transition-colors',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-muted bg-background hover:bg-accent/50',
                  )}
                  htmlFor={inputId}
                >
                  <div className="flex w-full items-center justify-between gap-3">
                    <span className="font-semibold">{option.label}</span>
                    {option.badge ? <Badge variant="secondary">{option.badge}</Badge> : null}
                  </div>
                  <span className="text-sm text-muted-foreground">{option.description}</span>
                  <span className="text-xs text-muted-foreground" id={detailId}>{option.detail}</span>
                </Label>
              </div>
            );
          })}
        </fieldset>
      </CardContent>
    </Card>
  );
}
