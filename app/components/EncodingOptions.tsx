import { useState, useId } from 'react';
import { Settings, Info, Clock, HardDrive, Cpu, Zap } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '~/components/ui/collapsible';
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group';
import { Label } from '~/components/ui/label';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Separator } from '~/components/ui/separator';
import { Alert, AlertDescription } from '~/components/ui/alert';
import type { EncodingOptions } from '~/modules/video/add-video/add-video.types';
import { 
  DEFAULT_ENCODING_OPTIONS,
  getEncodingDescription,
  getCodecName,
  getQualityParam,
  getQualityValue,
  getPresetValue,
  getDefaultOptionsForEncoder,
} from '~/utils/encoding';

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
  className = ''
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

  return (
    <Card className={className}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-accent/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-lg">H.265 Encoding</CardTitle>
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
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  {/* CPU Option */}
                  <div className="relative">
                    <RadioGroupItem value="cpu-h265" id={`cpu-h265-${uniqueId}`} className="peer sr-only" />
                    <Label 
                      htmlFor={`cpu-h265-${uniqueId}`} 
                      className="flex items-center justify-between rounded-lg border-2 border-muted bg-background p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Cpu className="h-5 w-5" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">CPU H.265</span>
                            <Badge variant="default" className="text-xs">Recommended</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Visually lossless • Best compression
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Auto: CRF 18, Slow preset
                          </p>
                        </div>
                      </div>
                    </Label>
                  </div>

                  {/* GPU Option */}
                  <div className="relative">
                    <RadioGroupItem value="gpu-h265" id={`gpu-h265-${uniqueId}`} className="peer sr-only" disabled={true} /> {/* TODO: Fix FFmpeg issue */}
                    <Label 
                      htmlFor={`gpu-h265-${uniqueId}`} 
                      className="flex items-center justify-between rounded-lg border-2 border-muted bg-background p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Zap className="h-5 w-5" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">GPU H.265</span>
                            <Badge variant="secondary" className="text-xs">Fast</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Near lossless • Fast encoding
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Auto: CQ 19, P6 preset
                          </p>
                        </div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <Separator />

              {/* Technical Details */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <h4 className="text-sm font-medium">Optimized Settings</h4>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>Codec: <code>{codecName}</code></div>
                  <div>Quality: <code>{qualityParam.toUpperCase()} {qualityValue}</code></div>
                  <div>Preset: <code>{presetValue}</code></div>
                  <div>Mode: <code>{value.encoder.includes('gpu') ? 'Hardware (NVENC)' : 'Software (CPU)'}</code></div>
                </div>
                {value.encoder === 'gpu-h265' && (
                  <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950/50 rounded text-xs">
                    <p className="text-blue-700 dark:text-blue-300">
                      <strong>GPU Acceleration:</strong> Requires NVIDIA GPU with NVENC support. 
                      Near lossless quality with P6 preset and high-quality tuning.
                    </p>
                  </div>
                )}
                {value.encoder === 'cpu-h265' && (
                  <div className="mt-3 p-2 bg-green-50 dark:bg-green-950/50 rounded text-xs">
                    <p className="text-green-700 dark:text-green-300">
                      <strong>CPU Encoding:</strong> Visually lossless quality with slow preset. 
                      Perfect for archival and premium streaming.
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
