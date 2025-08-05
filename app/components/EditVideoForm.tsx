import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "~/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import type { Video } from "~/types/video";
import { useState } from "react";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(1, "제목은 필수입니다").max(200, "제목은 200자 이내로 입력하세요"),
  tags: z.string(),
  description: z.string().max(1000, "설명은 1000자 이내로 입력하세요").optional(),
});

type FormData = {
  title: string;
  tags: string[];
  description?: string;
};

interface EditVideoFormProps {
  video: Video;
  onSave: (data: FormData) => Promise<void>;
  onCancel: () => void;
}

export function EditVideoForm({ video, onSave, onCancel }: EditVideoFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: video.title,
      tags: video.tags.join(', '),
      description: video.description || '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    try {
      const data: FormData = {
        title: values.title,
        tags: values.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0),
        description: values.description
      };
      await onSave(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>제목</FormLabel>
              <FormControl>
                <Input placeholder="비디오 제목을 입력하세요" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="tags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>태그</FormLabel>
              <FormControl>
                <Input 
                  placeholder="태그를 쉼표로 구분하여 입력하세요 (예: 액션, 코미디)" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>설명 (선택)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="비디오에 대한 설명을 입력하세요" 
                  className="resize-none"
                  rows={4}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            취소
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                저장 중...
              </>
            ) : (
              '저장'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}