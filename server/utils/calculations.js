// Same calculation rules as the original fee-ledger artifact:
//   Net Total = Registration Fee + Course Fee − Discount
//   Registration fee is collected at registration (its own payment row, type='registration')
//   1st installment = round((Net Total − Registration Fee) / 2)
//   2nd installment = (Net Total − Registration Fee) − 1st installment
//   Lumpsum = Net Total − Registration Fee (single payment row, type='lumpsum')

function netTotal(student) {
  return student.registration_fee + student.course_fee - (student.discount || 0);
}

function splitInstallments(student) {
  const remaining = netTotal(student) - student.registration_fee;
  const inst1 = Math.round(remaining / 2);
  const inst2 = remaining - inst1;
  return { inst1, inst2 };
}

function lumpsumAmount(student) {
  return netTotal(student) - student.registration_fee;
}

module.exports = { netTotal, splitInstallments, lumpsumAmount };
