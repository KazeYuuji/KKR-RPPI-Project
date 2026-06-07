import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

const endpoint = process.env.MINIO_ENDPOINT;
const accessKey = process.env.MINIO_ACCESS_KEY;
const secretKey = process.env.MINIO_SECRET_KEY;

if (!endpoint || !accessKey || !secretKey) {
  console.error('Missing MINIO_ENDPOINT, MINIO_ACCESS_KEY, or MINIO_SECRET_KEY');
  process.exit(1);
}

const client = new S3Client({
  endpoint,
  region: 'us-east-1',
  credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  forcePathStyle: true,
});

const cmd = new ListBucketsCommand({});

client.send(cmd)
  .then((res) => {
    console.log('OK');
    console.log(JSON.stringify(res, null, 2));
  })
  .catch(async (err) => {
    console.error('ERR', err.name, err.$metadata?.httpStatusCode || '-', err.message);
    if (err.$response) {
      console.error('RESPONSE KEYS:', Object.keys(err.$response));
      if (err.$response.body) {
        console.error('RESPONSE BODY KEYS:', Object.keys(err.$response.body));
        try {
          const body = Buffer.from(err.$response.body).toString('utf8');
          console.error('RAW BODY:', body.slice(0, 2000));
        } catch (inner) {
          console.error('RAW BODY ERROR:', inner);
        }
      }
    }
    console.error('RAW ERROR OBJECT:', err);
    process.exit(1);
  });
