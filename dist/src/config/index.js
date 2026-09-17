import dotenv from "dotenv";
import path from "node:path";
dotenv.config({ path: path.join(process.cwd(), ".env") });
export default {
    node_env: process.env.NODE_ENV,
    port: process.env.PORT,
    database_url: process.env.DATABASE_URL,
    app_url: process.env.APP_URL,
    jwt_access_secret: process.env.JWT_ACCESS_SECRET ?? "",
    jwt_refresh_secret: process.env.JWT_REFRESH_SECRET ?? "",
    jwt_access_expires_in: process.env.JWT_ACCESS_EXPIRES_IN ?? "",
    jwt_refresh_expires_in: process.env.JWT_REFRESH_EXPIRES_IN ?? "",
    bcrypt_salt_rounds: process.env.BCRYPT_SALT_ROUNDS,
    redis_user: process.env.REDIS_USER ?? "",
    redis_password: process.env.REDIS_PASSWORD ?? "",
    redis_host: process.env.REDIS_HOST ?? "",
    redis_port: process.env.REDIS_PORT ?? "",
    bkash_base_url: process.env.BKASH_BASE_URL,
    bkash_username: process.env.BKASH_USERNAME,
    bkash_password: process.env.BKASH_PASSWORD,
    bkash_app_key: process.env.BKASH_APP_KEY,
    bkash_app_secret: process.env.BKASH_APP_SECRET,
    bkash_callback_url: process.env.BKASH_CALLBACK_URL,
    super_admin: {
        name: process.env.SUPER_ADMIN_NAME,
        email: process.env.SUPER_ADMIN_EMAIL,
        password: process.env.SUPER_ADMIN_PASSWORD,
    },
    tester_admin: {
        name: process.env.TESTER_ADMIN_NAME,
        email: process.env.TESTER_ADMIN_EMAIL,
        password: process.env.TESTER_ADMIN_PASSWORD,
    },
    tester_faculty: {
        name: process.env.TESTER_FACULTY_NAME,
        email: process.env.TESTER_FACULTY_EMAIL,
        password: process.env.TESTER_FACULTY_PASSWORD,
    },
    tester_student: {
        name: process.env.TESTER_STUDENT_NAME,
        email: process.env.TESTER_STUDENT_EMAIL,
        password: process.env.TESTER_STUDENT_PASSWORD,
    },
};
//# sourceMappingURL=index.js.map