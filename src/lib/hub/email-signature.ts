// Laith's email signature (hub-rebuild/assets/email-signature.html), for emails sent from admin@ in the hub. The
// logo is the site's own public copy, not an attachment.
export function emailSignature(site: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin-top:8px"><tr>
    <td style="padding:0 18px 0 0;border-right:2px solid #20BD82;vertical-align:middle"><img src="${site}/logo-transparent.png" alt="Core Cleaning" width="110" style="display:block;width:110px;height:auto"></td>
    <td style="padding:0 0 0 18px;vertical-align:middle">
      <div style="font-size:17px;font-weight:700;color:#2D3142">Laith Humadi</div>
      <div style="font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#20BD82;margin-top:2px">Core Cleaning</div>
      <div style="font-size:12.5px;color:#5A5F6A;margin-top:8px">P 0407 026 360 · E admin@corecleaning.services · W www.corecleaning.services</div>
      <div style="font-size:11px;color:#9095A0;margin-top:6px">Residential · Commercial · Bond Cleaning</div>
    </td></tr></table>`
}
