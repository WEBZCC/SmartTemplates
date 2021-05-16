/* 
  BEGIN LICENSE BLOCK

  SmartTemplates is released under the Creative Commons (CC BY-ND 4.0)
  Attribution-NoDerivatives 4.0 International (CC BY-ND 4.0) 
  For details, please refer to license.txt in the root folder of this extension

  END LICENSE BLOCK 
*/

import * as crypto from './st-crypto.mjs.js';
import {RSA} from './rsa/RSA.mjs.js';
import {log} from './st-util.mjs.js';

const LicenseStates = {
    NotValidated: 0, // default status
    Valid: 1,
    Expired: 2, // valid, but expired
    Invalid: 3,
    MailNotConfigured: 4,
    MailDifferent: 5,
    Empty: 6,
}

// format  ST-EMAIL:DATE  // ;CRYPTO
//         S1-EMAIL:DATE  // ;CRYPTO
//        STD-EMAIL:DATE  // ;CRYPTO
// example: ST-joe.bloggs@gotmail.com:2015-05-20;
function getDate(license) {
  // get mail+date portion
  let arr = license.split(';');
  if (!arr.length) {
    log("getDate()", "failed - no ; found");
    return ""; 
  }
  // get date portion
  let arr1=arr[0].split(':');
  if (arr1.length<2) {
    log("getDate()", "failed - no : found");
    return '';
  }
  return arr1[1];
}

function getMail(license) {
  let arr1 = license.split(':');
  if (!arr1.length) {
    log("getMail()", "failed - no : found");
    return '';
  }
  let pos = arr1[0].indexOf('-') + 1;
  return arr1[0].substr(pos); // split off QF- or QFD-
}



export class Licenser {
  constructor(LicenseKey, options = {}) {
    // the constructor ONLY sets the Licensekey, it does not set date etc.
    this.reset();    
    this.ForceSecondaryIdentity = options.hasOwnProperty("forceSecondaryIdentity")
      ? options.forceSecondaryIdentity
      : false;
      
    this.SettingsRoot = options.hasOwnProperty("settingsRoot") ? options.settingsRoot : ""; // Legacy Place to store trial period
      
    this.LicenseKey = LicenseKey;
    this.key_type = crypto.getKeyType(LicenseKey);
    
    if (this.key_type == 1 && this.ForceSecondaryIdentity) {
      this.ForceSecondaryIdentity = false;
      log("Sorry, but forcing secondary email addresses with a Domain license is not supported!");
    }
  }
  
  reset() { // initialize License Cache
    this.ValidationStatus = LicenseStates.NotValidated;
    this.RealLicense = "";
    this.ExpiredDays = -1;
    this.LicensedDaysLeft = 0;
    this.decryptedDate = "";
    this.decryptedMail = "";
    this.GraceDate = "";
    this.TrialDays = 0 ;
  }
  
  // public Interface - note that "description" can be consumed by the front end.
  get info() {
    return {
      status: this.ValidationStatusShortDescription,
      description: this.ValidationStatusDescription,
      licensedDaysLeft: this.LicensedDaysLeft,
      expiredDays: this.ExpiredDays,
      expiryDate: this.decryptedDate,
      email: this.decryptedMail,
      licenseKey: this.LicenseKey,
      decryptedPart: this.RealLicense,
      keyType: this.key_type,
      // helper functions (transformed internal getters)
      isValid: this.isValid,
      isExpired: this.isExpired,
      graceDate: this.GraceDate,
      trialDays: this.TrialDays
    }
  }
  
  get ValidationStatusShortDescription() {
    switch(this.ValidationStatus) {
      case LicenseStates.Valid:
        return "Valid";
      case LicenseStates.Expired:
        return "Expired";
      case LicenseStates.NotValidated:
        return "NotValidated";     
      case LicenseStates.Invalid:
        return "Invalid";
      case LicenseStates.MailNotConfigured:
        return "MailNotConfigured";
      case LicenseStates.MailDifferent:
        return "MailDifferent";
      case LicenseStates.Empty:
        return "Empty";
      default: return "UnknownStatus";
    }
  }

  get ValidationStatusDescription() {
    switch(this.ValidationStatus) {
      case LicenseStates.Valid:
        return "Valid";
      case LicenseStates.Expired:
        return `Valid but expired since ${this.ExpiredDays} days`;
      case LicenseStates.NotValidated:
        return "Not Validated";     
      case LicenseStates.Invalid:
        return "Invalid";
      case LicenseStates.MailNotConfigured:
        return "Mail Not Configured";
      case LicenseStates.MailDifferent:
        return "Mail Different";
      case LicenseStates.Empty:
        return "Empty";
      default: return "Unknown Status";
    }
  }

  get isValid() {
    return (this.ValidationStatus == LicenseStates.Valid);
  }

  get isExpired() { // valid, but expired
    return (this.ValidationStatus == LicenseStates.Expired);
  }

  isIdMatchedLicense(idMail, licenseMail) {
    try {
      debugger;
      switch(this.key_type) {
        case 0: // pro license
        case 2: // standard license
          return (idMail.toLowerCase() == licenseMail);
        case 1: // domain matching 
          // only allow one *
          if ((licenseMail.match(/\*/g)||[]).length != 1)
              return false;
          // replace * => .*
          let r = new RegExp(licenseMail.replace("*",".*"));
          let t = r.test(idMail);
          return t;
      }
    }
    catch (ex) {
      log("validateLicense.isIdMatchedLicense() failed", ex);
    }
    return false;
  }
  
  getCrypto() {
    let arr = this.LicenseKey.split(';');
    if (arr.length<2) {
      log("getCrypto()","failed - no ; found");
      return null;
    }
    return arr[1];
  }
  
  // Testing purpose, may be removed
  encryptLicense () {
    log('encryptLicense - initialising with maxDigits:', this.RSA_maxDigits);
    RSA.initialise(this.RSA_maxDigits);
    // 64bit key pair
    log('encryptLicense - creating key pair object with bit length:', this.RSA_keylength);
    let key = new RSA.RSAKeyPair(
      this.RSA_encryption,
      this.RSA_decryption,
      this.RSA_modulus,
      this.RSA_keylength
    );
    log('encryptLicense - starting encryption…');
    let Encrypted = RSA.encryptedString(key, this.LicenseKey, 'OHDave');
    log('encryptLicense - finished encrypting registration key', {
      length: Encrypted.length,
      Encrypted
    });
    return Encrypted;    
  }    
  

  // Get these information from the crypto module, which is unique for each add-on.
  get RSA_encryption() {
    return ""
  }
  get RSA_decryption() {
    return crypto.getDecryption_key(this.key_type);
  }
  get RSA_modulus() {
    return crypto.getModulus(this.key_type);
  }
  get RSA_keylength() {
    return crypto.getKeyLength(this.key_type);      
  }
  get RSA_maxDigits() {
    return crypto.getMaxDigits(this.key_type);      
  }
  get Key_Type() {
    return crypto.getKeyType(this.LicenseKey);
  }

  getClearTextMail() { 
    return getMail(this.LicenseKey);
  }
  getDecryptedMail() {
    return getMail(this.RealLicense + ":xxx");
  }
  
  getDecryptedDate() {
    return getDate(this.RealLicense + ":xxx");
  }

  async validate() {
    this.reset();
    log("validateLicense", { LicenseKey: this.LicenseKey });
    
    if (!this.LicenseKey) {
      this.ValidationStatus = LicenseStates.Empty;
      log(this);
      return [this.ValidationStatus, ''];
    }    

    let encrypted = this.getCrypto();  
    if (!encrypted) {
      this.ValidationStatus = LicenseStates.Invalid;
      log('validateLicense()\n returns ', [
        this.ValidationStatusDescription,
        this.ValidationStatus,
      ]);
      return [this.ValidationStatus, ''];
    }
    
    log("RSA.initialise", this.RSA_maxDigits);
    RSA.initialise(this.RSA_maxDigits);
    log('Creating RSA key + decrypting');
    let key = new RSA.RSAKeyPair("", this.RSA_decryption, this.RSA_modulus, this.RSA_keylength);

    // verify against remainder of string
    try {
      log("get RSA.decryptedString()");
      this.RealLicense = RSA.decryptedString(key, encrypted);
      log("Decryption Complete", { RealLicense: this.RealLicense });
    } catch (ex) {
      log('RSA Decryption failed: ', ex);
    }
    
    if (!this.RealLicense) {
      this.ValidationStatus = LicenseStates.Invalid;
      log('validateLicense()\n returns ', [
        this.ValidationStatusDescription,
        this.ValidationStatus,
      ]);
      return [this.ValidationStatus, ''];
    }
    
    this.decryptedDate = this.getDecryptedDate();
    // check ISO format YYYY-MM-DD
    let regEx = /^\d{4}-\d{2}-\d{2}$/;
    if (!this.decryptedDate.match(regEx)) {
      this.ValidationStatus = LicenseStates.Invalid;
      log('encountered garbage date: ', this.decryptedDate);
      log('validateLicense()\n returns ', [
        this.ValidationStatusDescription,
        this.ValidationStatus,
      ]);
      this.decryptedDate = ""; // throw it away!
      return this.info;
    }

    // ******* CHECK MAIL IS MATCHING ********
    let clearTextEmail = this.getClearTextMail().toLocaleLowerCase();
    this.decryptedMail = this.getDecryptedMail().toLocaleLowerCase();
    if (clearTextEmail != this.decryptedMail) {
      this.ValidationStatus = LicenseStates.MailDifferent;
      log('validateLicense()\n returns ', [
        this.ValidationStatusDescription,
        this.ValidationStatus,
      ]);
      return this.info;
    }

    // ******* CHECK LICENSE EXPIRY  ********
    // get current date
    let today = new Date();
    let dateString = today.toISOString().substr(0, 10);
    if (this.decryptedDate < dateString) {
      let licDate = new Date(this.decryptedDate);
      this.ExpiredDays = parseInt((today - licDate) / (1000 * 60 * 60 * 24)); 
      log('validateLicense()\n returns ', [
        this.ValidationStatusDescription,
        this.ValidationStatus,
      ]);
      // Do not stop here, but continue the validation process and only if the
      // Valid state is reached, set to Expired.
      this.LicensedDaysLeft = 0;
    } else {
      let today = new Date(),
          licDate = new Date(this.decryptedDate);
      this.LicensedDaysLeft = parseInt((licDate - today) / (1000 * 60 * 60 * 24)); 
      this.ExpiredDays = 0;
    }

    
    // ******* MATCH MAIL ACCOUNT  ********
    // check mail accounts for setting
    // if not found return MailNotConfigured
    
    let accounts = await messenger.accounts.list();
    let AllowFallbackToSecondaryIdentiy = false;

    if (this.key_type == 0) {
      // Private License - Check if secondary mode is necessarry (if not already enforced)
      if (this.ForceSecondaryIdentity) {
        AllowFallbackToSecondaryIdentiy = true;
      } else {
        let hasDefaultIdentity = false;
        for (let account of accounts) {
          let defaultIdentity = await messenger.accounts.getDefaultIdentity(account.id);
          if (defaultIdentity) {
            hasDefaultIdentity = true;
            break;
          }
        }
        if (!hasDefaultIdentity) {
          AllowFallbackToSecondaryIdentiy = true;
          log("Premium License Check: There is no account with default identity!\n" +
              "You may want to check your account configuration as this might impact some functionality.\n" + 
              "Allowing use of secondary email addresses...");
        }
      }
    }
    
    for (let account of accounts) {
      let defaultIdentity = await messenger.accounts.getDefaultIdentity(account.id);
      if (defaultIdentity && !this.ForceSecondaryIdentity) {

        log("premium.licenser", {
            "Iterate accounts" : account.name,
            "Default Identity" : defaultIdentity.id,
        });
        if (!defaultIdentity.email) {
          log("Default Identity of this account has no associated email!", {account: account.name, defaultIdentity});
          continue;
        }
        if (this.isIdMatchedLicense(defaultIdentity.email, this.decryptedMail)) {
          this.ValidationStatus = (this.ExpiredDays == 0) ? LicenseStates.Valid : LicenseStates.Expired;
          log("Default Identity of this account matched!", {
            account: account.name, 
            identity: defaultIdentity.email,
            status: this.ValidationStatusDescription
          });
          return this.info;
        }

      } else if (AllowFallbackToSecondaryIdentiy) {

        log("premium.licenser", {
            "Iterate all identities of account" : account.name,
            "Identities" : account.identities,
        });
        for (let identity of account.identities) {
          if (this.ForceSecondaryIdentity && defaultIdentity && defaultIdentity.id == identity.id) {
            log("Skipping default identity!", {identity});
            continue;
          }          
          if (!identity.email) {
            log("Identity has no associated email!", {identity});
            continue;
          }
          if (this.isIdMatchedLicense(identity.email, this.decryptedMail)) {
            this.ValidationStatus = (this.ExpiredDays == 0) ? LicenseStates.Valid : LicenseStates.Expired;
            log("Identity of this account matched!", {
              account: account.name, 
              identity: identity.email,
              status: this.ValidationStatusDescription
            });
            return this.info;
          }
        }
        
      }
    }
    
    this.ValidationStatus = LicenseStates.MailNotConfigured;
    return this.info;
  }
}

