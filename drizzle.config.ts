import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// טוען את מחרוזת ההתחברות מתוך קובץ המפתחות שלנו
dotenv.config({ path: '.env.local' });

export default defineConfig({
    schema: './src/db/schema.ts', // שים לב: אם קובץ הסכמה שלך בתיקייה אחרת, עדכן את הנתיב
    out: './drizzle',
    dialect: 'postgresql', // <--- זו השורה שהייתה חסרה ל-Drizzle
    dbCredentials: {
        url: process.env.DATABASE_URL!,
    },
});