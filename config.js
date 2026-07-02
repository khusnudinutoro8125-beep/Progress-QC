const API_URL = 'https://script.google.com/macros/s/AKfycbwwesW0mQ3WUPwKLlY08W3wANR1FapC93Pgdkl30HT1pID6OVDeb4iCLW4vx_GCH4fImA/exec';
const PACKING_REFRESH_MS = 5000;   // packing cek perubahan tiap 5 detik
const MASTER_REFRESH_MS  = 5000;   // master (tujuan/posisi/part) cek tiap 5 detik
const RECONCILE_MS       = 120000; // rekonsiliasi ID tiap 2 menit
const SEND_TIMEOUT_MS    = 10000;  // batas 10 detik per percobaan kirim
