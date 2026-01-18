# Payment Server

A production-ready serverless backend for tournament payments with UPI verification and wallet management.

## Features

- **UPI Payment Processing**: Create payment orders with dynamic UPI IDs
- **Payment Verification**: Server-side verification of UPI transactions
- **Wallet Management**: Secure wallet system with transaction history
- **Idempotency**: Protection against duplicate payments
- **Distributed Locks**: Prevent race conditions in serverless environment
- **Expiry Management**: Automatic order expiry after 5 minutes
- **Firebase Integration**: Real-time database for all operations
- **Vercel Deployment**: Serverless deployment with automatic scaling

## Tech Stack

- **Runtime**: Node.js (18+)
- **Framework**: Express.js
- **Database**: Firebase Realtime Database
- **Deployment**: Vercel Serverless Functions
- **Security**: Helmet, CORS, Rate Limiting
- **Validation**: Joi, Express Validator

## Project Structure
