export interface IngestMediaAnalysis {
  containerFormat?: string;
  duration: number;
  primaryAudio?: {
    codecName?: string;
    streamIndex: number;
  };
  primaryVideo?: {
    codecName?: string;
    height?: number;
    streamIndex: number;
    width?: number;
  };
}

export type IngestMediaPreparationStrategy =
  | 'remux_then_package'
  | 'copy_video_transcode_audio'
  | 'copy_video_synthesize_audio'
  | 'transcode_video_copy_audio'
  | 'full_transcode'
  | 'reject';

const PRESERVED_VIDEO_CODECS = new Set(['h264', 'hevc']);
const PRESERVED_AUDIO_CODECS = new Set(['aac']);

export function selectIngestMediaPreparationStrategy(
  analysis: IngestMediaAnalysis,
): IngestMediaPreparationStrategy {
  const videoCodec = normalizeCodecName(analysis.primaryVideo?.codecName);

  if (!analysis.primaryVideo || !videoCodec) {
    return 'reject';
  }

  const audioCodec = normalizeCodecName(analysis.primaryAudio?.codecName);
  const hasAcceptedVideo = PRESERVED_VIDEO_CODECS.has(videoCodec);
  const hasAcceptedAudio = audioCodec ? PRESERVED_AUDIO_CODECS.has(audioCodec) : false;

  if (hasAcceptedVideo && hasAcceptedAudio) {
    return 'remux_then_package';
  }

  if (hasAcceptedVideo && audioCodec) {
    return 'copy_video_transcode_audio';
  }

  if (hasAcceptedVideo) {
    return 'copy_video_synthesize_audio';
  }

  if (hasAcceptedAudio) {
    return 'transcode_video_copy_audio';
  }

  return 'full_transcode';
}

function normalizeCodecName(codecName?: string) {
  return codecName?.trim().toLowerCase();
}
