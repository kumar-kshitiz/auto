import fs from "fs";
import latex from "node-latex";
// const input = fs.createReadStream('./resume_latex/resume.tex');
async function compileLatexResume(generated_latex,count){
    const pdf = latex(generated_latex);
    pdf.pipe(fs.createWriteStream(`./generated_resume/resume-output-${count}.pdf`));
    pdf.on('error',err=>console.log(err));  
    pdf.on('finish', () => console.log('PDF generated!'));
}

export {compileLatexResume};