// Local browser fixture binds the same managed controller, with a synthetic challenge and exact fictional inputs.
import {mountContactForm} from "/internal/contact-platform/form-controller.mjs";
import {isSyntheticContact} from "/internal/contact-platform/d1-store.mjs";
let n=0;
// One synthetic challenge per page attempt; existing staging verifier accepts only the lab token.
mountContactForm({privacyVersion:"synthetic-v1",getChallenge:async()=>{n++;return "synthetic-test-"+n;},acceptInput:isSyntheticContact,receiptTitle:"Consulta sintética recibida"});
