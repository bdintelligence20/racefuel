/**
 * Plugin configuration. The interesting one here is the upload provider: we
 * push media to a GCS bucket so uploads survive container restarts and the
 * read-only Cloud Run filesystem isn't a problem.
 *
 * In Cloud Run we rely on Application Default Credentials from the service
 * account attached to the service — `serviceAccount` is intentionally left
 * undefined. For local dev set GCS_SERVICE_ACCOUNT to a JSON key path or
 * run `gcloud auth application-default login` and the plugin will pick up
 * the ADC automatically.
 */
export default ({ env }) => ({
  upload: {
    config: {
      provider: '@strapi-community/strapi-provider-upload-google-cloud-storage',
      providerOptions: {
        bucketName: env('GCS_BUCKET_NAME'),
        basePath: env('GCS_BASE_PATH', 'uploads'),
        baseUrl: env('GCS_BASE_URL'),
        publicFiles: true,
        uniform: env.bool('GCS_UNIFORM', false),
        serviceAccount: env.json('GCS_SERVICE_ACCOUNT', undefined),
      },
      actionOptions: {
        upload: {},
        uploadStream: {},
        delete: {},
      },
    },
  },
});
