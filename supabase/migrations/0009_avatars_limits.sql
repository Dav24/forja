-- Límites del bucket avatars: máx 1 MB, solo JPEG
-- (0008 creó el bucket sin límites; el cliente sube JPEG 512x512 comprimido ~0.7)
update storage.buckets
set file_size_limit = 1048576,
    allowed_mime_types = '{image/jpeg}'
where id = 'avatars';
