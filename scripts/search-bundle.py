import re
path = r'C:\Windows\Temp\minio-bundle.js'
pattern = re.compile(r'(MinIO|MINIO|minio|endpoint|host|bucket|accessKey|secretKey|api|port)', re.I)
count = 0
with open(path, 'r', errors='ignore') as f:
    for i, line in enumerate(f, 1):
        if pattern.search(line):
            print(i, line.strip())
            count += 1
            if count >= 50:
                break
