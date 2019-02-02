console.log(process.env.NEXUS_PASSWORD);
console.log(process.env.NEXUS_USER);
console.log(process.env.NEXUS_REPO);
const request = require('request-promise');
const fs = require('fs');
const path = require('path');


const getAssets = (assetsPath) => new Promise((resolve, reject) => {
    fs.readdir(assetsPath, {withFileTypes: true}, (err, files) => {
        if (err) {
            return reject(err);
        }

        return resolve([...files]
            .filter((file) => !file.isDirectory())
            .reduce((assets, {name}, index) => {
                return {
                    [`raw.asset${index + 1}`]: fs.createReadStream(path.resolve(assetsPath, name)),
                    [`raw.asset${index + 1}.filename`]: name,
                    ...assets,
                }
            }, {}));
    });
});

async function uploadAssetsToNexus(assetsPath, repo, user, password) {
    const assets = await getAssets(path.resolve(assetsPath));
    return request({
        method: 'post',
        url: repo,
        'auth': {
            'user': user,
            'password': password,
        },
        formData: {
            'raw.directory': '/',
            ...assets
        },
    })
};


uploadAssetsToNexus('./dist', process.env.NEXUS_REPO, process.env.NEXUS_USER, process.env.NEXUS_PASSWORD)
    .then((r) => {
        console.log(r)
    })
    .catch((e) => {
        console.log(e)
    });