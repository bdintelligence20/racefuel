/**
 * Public-role permissions for the Article collection type aren't set by the
 * schema — they live in the database. Granting them by hand in the admin UI
 * after every fresh deploy is brittle (forget once and the frontend 403s),
 * so we wire them in on every boot. The check is idempotent: it only writes
 * when a row is missing.
 *
 * Touching just the two actions the frontend needs (find + findOne) keeps
 * this from accidentally exposing create/update/delete.
 */
async function grantPublicArticleReadAccess({ strapi }: { strapi: any }) {
  const publicRole = await strapi
    .query('plugin::users-permissions.role')
    .findOne({ where: { type: 'public' } });

  if (!publicRole) {
    strapi.log.warn('Public role not found — skipping article permission bootstrap.');
    return;
  }

  const actions = [
    'api::article.article.find',
    'api::article.article.findOne',
  ];

  for (const action of actions) {
    const existing = await strapi
      .query('plugin::users-permissions.permission')
      .findOne({ where: { action, role: publicRole.id } });

    if (!existing) {
      await strapi.query('plugin::users-permissions.permission').create({
        data: { action, role: publicRole.id },
      });
      strapi.log.info(`Granted public access: ${action}`);
    }
  }
}

export default {
  register(/* { strapi } */) {},

  async bootstrap({ strapi }: { strapi: any }) {
    await grantPublicArticleReadAccess({ strapi });
  },
};
