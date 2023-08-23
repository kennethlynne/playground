import debug from 'debug';
import download from 'download';
import fs from 'fs';
import mime from 'mime-types';
import path from 'path';
import Replicate from "replicate";

const log = debug('workflow');

const replicateAPIKey = import.meta.env.VITE_REPLICATE_API_TOKEN as string;

if (!replicateAPIKey) {
    throw new Error('REPLICATE_API_KEY is not set');
}

log('Replicate API key found');

const replicate = new Replicate({
    auth: replicateAPIKey,
});

// Find the first file in the style directory
const styleDir = './style'; // replace with your style directory
const styleFiles = fs.readdirSync(styleDir);
const firstStyleFile = path.join(styleDir, styleFiles[0]);

// Read the first style file as base64
const styleImageBase64 = fs.readFileSync(firstStyleFile).toString('base64');
const styleImageMimeType = mime.lookup(firstStyleFile) || 'application/octet-stream';

log('Running clip...')
const clipOutput = await replicate.run(
    "lucataco/sdxl-clip-interrogator:d90ed1292165dbad1fc3fc8ce26c3a695d6a211de00e2bb5f5fec4815ea30e4c",
    {
        input: {
            image: `data:${styleImageMimeType};base64,${styleImageBase64}`
        }
    }
);
log(`Clip run complete. Output: ${clipOutput}`);

const model = "stability-ai/sdxl:d830ba5dabf8090ec0db6c10fc862c6eb1c929e1a194a5411852d25fd954ac82";
const input = {
    prompt: `${clipOutput}, beautiful detailed eyes, looking into camera, close shot, professional award winning portrait photography, cinematic, Zeiss 150mm f/2.8, highly detailed eyes, high detailed skin, skin pores, film grain`,
    negative_prompt: 'ugly, deformed, drawing, painting, crayon, sketch, graphite, impressionist, noisy, blurry, soft, deformed, ugly',
    height: 1024,
    width: 1024,
    scheduler: 'KarrasDPM',
    num_inference_steps: 50,
    guidance_scale: 7.5,
    prompt_strength: 0.8,
    refine: 'expert_ensemble_refiner',
    high_noise_frac: 0.8,
};

log('Running model...');
const output = await replicate.run(model, { input });
log('Model run complete');

log('Output:');
log(output);

if (Array.isArray(output)) {
    const tempDir = './temp';
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }
    let index = 0;

    output.forEach(async (url) => {
        const ext = path.extname(url);
        let filename;
        do {
            filename = `${index}${ext}`;
            index++;
        } while (fs.existsSync(path.join(tempDir, filename)));
        log(`Downloading file ${filename}...`);

        const data = await download(url, tempDir, { filename });
        log(`File ${filename} downloaded`);

        const base64 = data.toString("base64");
        log(`Received data length: ${base64.length}`);

        const mimeType = mime.lookup(ext) || 'application/octet-stream';
        log(`Mime type: ${mimeType}`);

        const dataURI = `data:${mimeType};base64,${base64}`;

        log('Running codeformer...')
        const codeformerUrl = await replicate.run(
            "sczhou/codeformer:7de2ea26c616d5bf2245ad0d5e24f0ff9a6204578a5c876db53142edd9d2cd56",
            {
                input: {
                    image: dataURI,
                    upscale: 2,
                    codeformer_fidelity: 0.5
                }
            }
        ) as unknown as string;
        log('Codeformer run complete');
        const upscaledFilename = `${index}_hq${ext}`;
        const upscaled = await download(codeformerUrl, tempDir, { filename: upscaledFilename });

        log(`File ${upscaledFilename} downloaded`);

        const upscaledBase64 = upscaled.toString("base64");

        // Find the first file in the source directory
        const sourceDir = './source'; // replace with your source directory
        const files = fs.readdirSync(sourceDir);
        const firstFile = path.join(sourceDir, files[0]);

        // Read the first file as base64
        const swapImage = fs.readFileSync(firstFile).toString('base64');

        log('Running faceswap...')
        const swappedUrl = await replicate.run(
            "lucataco/faceswap:9a4298548422074c3f57258c5d544497314ae4112df80d116f0d2109e843d20d",
            {
                input: {
                    target_image: `data:${mimeType};base64,${upscaledBase64}`,
                    swap_image: `data:${mimeType};base64,${swapImage}`,
                }
            }
        ) as unknown as string;
        log('Faceswap run complete');

        const swappedFilename = `${index}_swapped${ext}`;
        await download(swappedUrl, tempDir, { filename: swappedFilename });

        log(`File ${swappedFilename} downloaded`);
    });
} else {
    console.error('Received unexpected output from model');
}
