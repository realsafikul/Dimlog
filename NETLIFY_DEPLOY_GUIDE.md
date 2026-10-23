# ⚡ VoltLog – Firebase Cloud & Netlify Deployment Guide

এই গাইডে আপনার **VoltLog (Power Cut Reporter)** ওয়েবসাইটটি **Firebase Realtime Database (`dimlog-d0f35`)** এবং **Netlify**-তে সফলভাবে চালু করার সম্পূর্ণ ধাপ দেওয়া হয়েছে।

---

## ১. Firebase Authentication Setup (প্রয়োজনীয়)

Firebase Realtime Database-এ unauthorized প্রবেশ ঠেকাতে এবং নিরাপদ ডেটা স্টোরেজের জন্য Firebase Authentication সক্রিয় করতে হবে:

1. [Firebase Console](https://console.firebase.google.com/)-এ যান এবং আপনার প্রজেক্ট **`dimlog-d0f35`** সিলেক্ট করুন।
2. বাম পাশের মেনু থেকে **Build ➔ Authentication**-এ যান।
3. **Get Started** বাটনে ক্লিক করুন।
4. **Sign-in method** ট্যাবে গিয়ে **Email/Password** সিলেক্ট করে **Enable** করুন এবং **Save** করুন।
5. **Users** ট্যাবে গিয়ে **Add user** ক্লিক করে আপনার নিজস্ব অনুমোদিত ইমেইল ও পাসওয়ার্ড তৈরি করুন (অথবা ওয়েবসাইটের **"Register Staff"** ট্যাব দিয়ে রেজিস্ট্রেশন করুন)।
6. **Project Settings (⚙️ icon)** ➔ **General** ট্যাবে যান:
   - নিচে **Your apps** বা **Web API Key** দেখতে পাবেন (যেমন: `AIzaSy...`)।
   - এটি কপি করে ওয়েবসাইটের **Cloud Mode / Staff Login** মডালে পেস্ট করুন অথবা Netlify-তে `VITE_FIREBASE_API_KEY` এনভায়রনমেন্ট ভ্যারিয়েবলে বসান।

---

## ২. Firebase Realtime Database Security Rules

Unauthenticated ইউজারদের ডেটা রিড/রাইট বন্ধ রাখতে `database.rules.json` ফাইলে দেওয়া রুলস Firebase Console-এ সেট করুন:

1. Firebase Console-এ **Build ➔ Realtime Database**-এ যান।
2. **Rules** ট্যাবে ক্লিক করুন।
3. নিচের JSON রুলসটি হুবহু পেস্ট করে **Publish** করুন:

```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "power_status": {
      ".read": "auth != null",
      ".write": "auth != null",
      ".validate": "newData.hasChildren(['isOutage', 'updatedAt'])",
      "isOutage": {
        ".validate": "newData.isBoolean()"
      },
      "outAt": {
        ".validate": "newData.val() === null || newData.isNumber()"
      },
      "updatedAt": {
        ".validate": "newData.isNumber()"
      }
    },

    "logs": {
      ".read": "auth != null",
      ".indexOn": ["ts", "type"],
      "$logId": {
        ".write": "auth != null",
        ".validate": "newData.hasChildren(['type', 'ts'])",
        "type": {
          ".validate": "newData.val() === 'out' || newData.val() === 'in'"
        },
        "ts": {
          ".validate": "newData.isNumber()"
        },
        "note": {
          ".validate": "!newData.exists() || newData.isString()"
        },
        "createdAt": {
          ".validate": "newData.isNumber()"
        }
      }
    },

    "settings": {
      ".read": "auth != null",
      ".write": "auth != null"
    },

    "users": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid === $uid"
      }
    }
  }
}
```

> **নিরাপত্তা নোট:** কোনো অবস্থাতেই `".read": true` বা `".write": true` ব্যবহার করবেন না। উপরের রুলস শুধু অনুমোদিত অথেনটিকেটেড ইউজারদেরই ডেটা রিড ও রাইট করার অনুমতি দেয়।

---

## ৩. Netlify Deployment নির্দেশাবলী

### পদ্ধতি ক: Git রিপোজিটরি দিয়ে (অটোমেটিক বিল্ড - রেকমেন্ডেড)
1. গিটহাবে কোড পুশ করুন।
2. [Netlify](https://app.netlify.com)-এ লগইন করে **Add new site ➔ Import an existing project** সিলেক্ট করুন।
3. আপনার গিটহাব রিপোজিটরি বেছে নিন।
4. বিল্ড সেটিংস অটোমেটিক `netlify.toml` থেকে নিয়ে নেবে:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. **Environment variables** সেকশনে যান এবং যোগ করুন:
   - **Key:** `VITE_FIREBASE_API_KEY`
   - **Value:** `আপনার Firebase Web API Key`
6. **Deploy Site**-এ ক্লিক করুন।

### পদ্ধতি খ: Drag & Drop (ম্যানুয়াল ডেপ্লয়)
1. টার্মিনালে `npm run build` চালান।
2. আপনার প্রোজেক্টে তৈরি হওয়া `dist` ফোল্ডারটি জিপ করুন অথবা সরাসরি https://app.netlify.com/drop পেজে টেনে ড্রপ করুন।

---

## ৪. LocalStorage Data Migration নির্দেশিকা

যদি আপনার আগের ব্রাউজারে পুরোনো কোনো লগস থেকে থাকে:
1. ওয়েবসাইটে গিয়ে টপ বারের **Cloud Status** বাটনে ক্লিক করুন।
2. আপনার একাউন্টে লগইন করুন।
3. টপ বারে উজ্জ্বল **"Migrate (X)"** বাটনটি দেখতে পাবেন।
4. বাটনে ক্লিক করলে মাইগ্রেশন উইন্ডো খুলবে:
   - প্রথমে **"Export Backup First"** বাটনে ক্লিক করে আপনার লোকাল ডেটার ব্যাকআপ ডাউনলোড করে রাখুন।
   - সব রেকর্ড প্রিভিউ দেখুন।
   - **"Start Migration"** বাটনে চাপলে স্বয়ংক্রিয়ভাবে ক্লাউডে ট্রান্সফার হবে এবং কোনো ডুপ্লিকেট এন্ট্রি তৈরি হবে না।
   - আপনার সম্মতি ছাড়া পুরোনো ডেটা মোছা হবে না।

---

## ৫. Testing Checklist

- [x] **Firebase Connection:** টপ বারের ক্লাউড ব্যাজে ক্লিক করে লগইন করলে সবুজ "Cloud Synced" বাতি জ্বলে।
- [x] **Power Cut Logging:** "Electricity Out" বাটনে চাপ দিলে Realtime Database-এ `power_status` এবং `logs` তৈরি হয়।
- [x] **Multi-Device Realtime Sync:** কম্পিউটার থেকে বাটন চাপলে মোবাইল স্ক্রিনে তাৎক্ষণিক পরিবর্তন প্রতিফলিত হয়।
- [x] **Page Reload Test:** রিলোড দিলেও ক্লাউড থেকে সব ডেটা ও গ্রাফ সঠিকভাবে লোড হয়।
- [x] **Filters & Search:** Today, 7 Days, Outages Only এবং টেক্সট সার্চ কাজ করে।
- [x] **Edit & Delete:** প্রতিটি এন্ট্রির নোট/টাইম এডিট এবং ডিলিট অপারেশন ক্লাউডের সাথে সিঙ্ক হয়।
- [x] **Export Formats:** 📋 Copy All, WhatsApp Share, CSV Export এবং JSON Backup কাজ করে।
- [x] **Security Validation:** লগআউট অবস্থায় থাকলে ডেটাবেস নিরাপদ থাকে এবং অনুমোদিত লগইন ছাড়া কোনো রাইট হয় না।
