import { GenerationService } from '../services/generationService';

/** Сохраняет результат генерации в Storage; при ошибке возвращает исходные URL (data / внешние ссылки). */
export async function persistGeneratedImageUrls(generationId: string, rawUrls: string[]): Promise<string[]> {
  if (rawUrls.length === 0) return [];
  const allAlreadyStored = rawUrls.every(
    (u) => /^https?:\/\//i.test(u) && u.includes('/generated-images/')
  );
  if (allAlreadyStored) return rawUrls;

  const { urls, error } = await GenerationService.uploadGeneratedImageSources(generationId, rawUrls);
  if (error || !urls?.length) {
    console.warn('persistGeneratedImageUrls: не удалось сохранить в Storage, оставляем исходные ссылки', error);
    return rawUrls;
  }
  return urls;
}
