# Wise API Integration Expert Needed - SCA Authentication & Webhook Setup

## Job Title
Wise (TransferWise) API Integration - Fix SCA Authentication & Setup Webhooks

## Category
Web Development > API Integration

## Experience Level
Expert

## Project Duration
Less than 1 week

## Budget
Fixed Price: $200-500 (or suggest your rate)

---

## Job Description

I need an experienced developer who has **proven experience** with the Wise (formerly TransferWise) API, specifically with Strong Customer Authentication (SCA) for accessing balance statements.

### Current Situation
- We have a Node.js/Express backend application
- We've been trying to integrate Wise API for transaction syncing for 3 days
- SCA authentication keeps returning **"REJECTED"** despite correct setup
- We have X.509 public key uploaded, correct signature algorithm (RSA-SHA256), UTF-8 encoding
- All technical requirements appear to be met, but Wise still rejects the signature

### What We Need

**1. Working Wise API Transaction Sync**
- Successfully authenticate with Wise API using SCA (Strong Customer Authentication)
- Fetch transaction history from Wise balance accounts (EUR, PLN, USD)
- Successfully sync transactions into our database
- **You must demonstrate this working** before final payment

**2. Wise Webhook Setup**
- Configure Wise webhooks to notify our system when transactions occur
- Create webhook endpoint to receive and capture transaction data
- Ensure webhook signature verification is properly implemented
- Test that webhooks are triggered and data is captured correctly

### Requirements

**Must Have:**
- Proven experience with Wise (TransferWise) API - **show examples**
- Experience with SCA (Strong Customer Authentication) implementation
- Experience with RSA key signing and verification
- Node.js/Express expertise
- Understanding of webhook implementation and signature verification

**Deliverables:**
- Working code that successfully syncs transactions from Wise API
- Working webhook endpoint that captures Wise transaction events
- Documentation of any account settings or approvals needed from Wise
- Brief explanation of what was wrong with our implementation

### Our Current Stack
- **Backend**: Node.js, Express
- **Database**: PostgreSQL
- **Hosting**: Railway.app
- **Frontend**: React (but you only need to work on backend API)

### Important Notes
- We have the Wise account, API token, and RSA keys already set up
- Profile ID: 74801255
- We can provide access to our codebase if needed
- We need someone who can troubleshoot why SCA keeps getting rejected
- This could be an account permission issue, approval issue, or code issue

### To Apply

Please include in your proposal:
1. **Evidence of Wise API experience** (screenshots, links to similar projects, etc.)
2. Have you worked with Wise SCA authentication before? Describe the experience.
3. Your approach to debugging the REJECTED signature issue
4. Estimated timeline to complete both requirements
5. Your fixed price or hourly rate

### Success Criteria
- We can successfully fetch 255+ transactions from Wise API
- Webhook receives and logs transaction events when they occur in Wise
- Code is clean, documented, and we can maintain it

### Additional Information
We've already done extensive debugging:
- Generated RSA keys in correct format (OpenSSL PEM for private, X.509 for public)
- Implemented UTF-8 encoding for signature generation
- Verified key pair matches (modulus comparison)
- Deployed to production with all fixes
- Still getting `x-2fa-approval-result: REJECTED` from Wise

We suspect this might be:
- An account approval/permission issue with Wise
- A subtle signature format issue we're missing
- A specific Wise account configuration needed

**If you've solved Wise SCA authentication issues before, this is the job for you.**

---

## Skills Required
- Wise API
- TransferWise API
- SCA Authentication
- RSA Signatures
- Node.js
- Express.js
- Webhook Implementation
- API Integration
- Cryptography

## Screening Questions
1. Have you worked with the Wise (TransferWise) API before?
2. Have you implemented SCA (Strong Customer Authentication) for Wise API?
3. Can you provide evidence of a working Wise API integration you've built?
4. What's your experience with webhook signature verification?
5. How would you approach debugging a signature that keeps getting rejected?

---

**Note to Applicants**: Please don't apply if you haven't worked with Wise API before. We need someone who has solved this exact problem, not someone willing to learn on our project.

We've spent 3 days debugging this ourselves - we need an expert who can quickly identify the issue and implement the solution.

**Timeline**: We need this solved within 2-3 days maximum.

**Payment**: Milestone-based
- 50% when you successfully sync transactions from Wise API
- 50% when webhooks are working and verified
