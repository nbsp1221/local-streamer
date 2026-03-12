import { Clock, Cpu, HardDrive, Info, Settings, Zap } from 'lucide-react';
import { useId, useState } from 'react';
import type { EncodingOptions } from '~/legacy/modules/video/add-video/add-video.types';
import { Alert, AlertDescription } from '~/legacy/components/ui/alert';
import { Badge } from '~/legacy/components/ui/badge';
import { Button } from '~/legacy/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/legacy/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/legacy/components/ui/collapsible';
import { Label } from '~/legacy/components/ui/label';
import { RadioGroup, RadioGroupItem } from '~/legacy/components/ui/radio-group';
import { Separator } from '~/legacy/components/ui/separator';
import {
  DEFAULT_ENCODING_OPTIONS,
  getCodecName,
  getDefaultOptionsForEncoder,
  getEncodingDescription,
  getPresetValue,
  getQualityParam,
  getQualityValue,
} from '~/legacy/utils/encoding';

interface EncodingOptionsProps {
  value: EncodingOptions;
  onChange: (options: EncodingOptions) => void;
  fileSize?: number;
  className?: string;
}

export function EncodingOptionsComponent({
  value,
  onChange,
  fileSize,
  className = '',
}: EncodingOptionsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const uniqueId = useId();

  const currentDescription = getEncodingDescription(value);
  const codecName = getCodecName(value.encoder);
  const qualityParam = getQualityParam(value.encoder);
  const qualityValue = getQualityValue(value.encoder);
  const presetValue = getPresetValue(value.encoder);

  const handleEncoderChange = (encoder: EncodingOptions['encoder']) => {
    onChange(getDefaultOptionsForEncoder(encoder));
  };

  const resetToDefaults = () => {
    onChange(DEFAULT_ENCODING_OPTIONS);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const encoderOptions: Array<{
    badge?: { label: string; variant: 'default' | 'secondary' | 'outline' };
    description: string;
    encoder: EncodingOptions['encoder'];
    icon: typeof Cpu;
    technicalHint: string;
    title: string;
  }> = [
    {
      badge: { label: 'Recommended', variant: 'default' },
      description: 'Browser-safe default with balanced compression',
      encoder: 'cpu-h264',
      icon: Cpu,
      technicalHint: 'Auto: CRF 20, Slow preset',
      title: 'CPU H.264',
    },
    {
      badge: { label: 'Fast', variant: 'secondary' },
      description: 'Browser-safe default with faster hardware encoding',
      encoder: 'gpu-h264',
      icon: Zap,
      technicalHint: 'Auto: CQ 21, P6 preset',
      title: 'GPU H.264',
    },
    {
      badge: { label: 'Archive', variant: 'outline' },
      description: 'Better compression when HEVC playback support is acceptable',
      encoder: 'cpu-h265',
      icon: Cpu,
      technicalHint: 'Auto: CRF 18, Slow preset',
      title: 'CPU H.265',
    },
    {
      badge: { label: 'HEVC Fast', variant: 'outline' },
      description: 'Hardware HEVC option for explicit archival workflows',
      encoder: 'gpu-h265',
      icon: Zap,
      technicalHint: 'Auto: CQ 19, P6 preset',
      title: 'GPU H.265',
    },
  ];

  return (
    <Card className={className}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-lg">Browser Playback Encoding</CardTitle>
                  <CardDescription>
                    {currentDescription.title} • {currentDescription.estimatedSpeed}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {codecName} {qualityParam.toUpperCase()} {qualityValue}
                </Badge>
                <Button variant="ghost" size="sm">
                  {isOpen ? 'Hide' : 'Configure'}
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <div className="space-y-6">
              {/* Current Settings Overview */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1">
                      <HardDrive className="h-3 w-3" />
                      {currentDescription.estimatedSize}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {currentDescription.estimatedSpeed}
                    </span>
                    {fileSize && (
                      <span className="text-muted-foreground">
                        Original: {formatFileSize(fileSize)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1">{currentDescription.description}</p>
                </AlertDescription>
              </Alert>

              <Separator />

              {/* Encoder Selection with Radio Buttons */}
              <div className="space-y-4">
                <Label className="text-base font-medium">Processing Method</Label>
                <RadioGroup
                  value={value.encoder}
                  onValueChange={handleEncoderChange}
                  className="grid grid-cols-1 gap-4 md:grid-cols-2"
                >
                  {encoderOptions.map((option) => {
                    const Icon = option.icon;
                    const optionId = `${option.encoder}-${uniqueId}`;

                    return (
                      <div key={option.encoder} className="relative">
                        <RadioGroupItem value={option.encoder} id={optionId} className="peer sr-only" />
                        <Label
                          htmlFor={optionId}
                          className="flex items-center justify-between rounded-lg border-2 border-muted bg-background p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="h-5 w-5" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold">{option.title}</span>
                                {option.badge ? <Badge variant={option.badge.variant} className="text-xs">{option.badge.label}</Badge> : null}
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {option.description}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {option.technicalHint}
                              </p>
                            </div>
                          </div>
                        </Label>
                      </div>
                    );
                  })}
                </RadioGroup>
              </div>

              <Separator />

              {/* Technical Details */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-medium">Optimized Settings</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>
                    Codec:
                    <code>{codecName}</code>
                  </div>
                  <div>
                    Quality:
                    <code>{qualityParam.toUpperCase()} {qualityValue}</code>
                  </div>
                  <div>
                    Preset:
                    <code>{presetValue}</code>
                  </div>
                  <div>
                    Mode:
                    <code>{value.encoder.includes('gpu') ? 'Hardware (NVENC)' : 'Software (CPU)'}</code>
                  </div>
                </div>
                {value.encoder === 'gpu-h264' && (
                  <div className="mt-3 rounded bg-blue-50 p-2 text-xs dark:bg-blue-950/50">
                    <p className="text-blue-700 dark:text-blue-300">
                      <strong>GPU Acceleration:</strong>
                      {' '}
                      Requires NVIDIA GPU with NVENC support.
                      This keeps the browser-safe H.264 path while reducing encode time.
                    </p>
                  </div>
                )}
                {value.encoder === 'cpu-h264' && (
                  <div className="mt-3 rounded bg-green-50 p-2 text-xs dark:bg-green-950/50">
                    <p className="text-green-700 dark:text-green-300">
                      <strong>Browser-safe default:</strong>
                      {' '}
                      Recommended for the widest playback compatibility across Chromium-class browsers.
                    </p>
                  </div>
                )}
                {value.encoder === 'gpu-h265' && (
                  <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/50 rounded text-xs">
                    <p className="text-blue-700 dark:text-blue-300">
                      <strong>HEVC Opt-in:</strong>
                      {' '}
                      Requires NVIDIA GPU with NVENC support.
                      Use only when your playback targets can decode HEVC.
                    </p>
                  </div>
                )}
                {value.encoder === 'cpu-h265' && (
                  <div className="mt-3 p-2 bg-green-50 dark:bg-green-950/50 rounded text-xs">
                    <p className="text-green-700 dark:text-green-300">
                      <strong>HEVC Archive:</strong>
                      {' '}
                      Better compression efficiency, but browser playback support is less reliable than H.264.
                    </p>
                  </div>
                )}
              </div>

              {/* Reset Button */}
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={resetToDefaults}>
                  Reset to Default
                </Button>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
