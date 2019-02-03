const password = process.env.NEXUS_PASSWORD;
const user = process.env.NEXUS_USER;
const repo = process.env.NEXUS_REPO;
const request = require('request-promise');
const fs = require('fs');
const path = require('path');


const getNewAssets = (assetsPath, existsAssetsMap, skipUpload) => new Promise((resolve, reject) => {
    fs.readdir(assetsPath, {withFileTypes: true}, (err, files) => {
        if (err) {
            return reject(err);
        }

        return resolve([...files]
            .filter((file) => !file.isDirectory())
            .filter(({name}) => !existsAssetsMap.includes(name))
            .filter(({name}) => !skipUpload.includes(name))
            .reduce((assets, {name}, index) => {
                return {
                    [`raw.asset${index + 1}`]: fs.createReadStream(path.resolve(assetsPath, name)),
                    [`raw.asset${index + 1}.filename`]: name,
                    ...assets,
                }
            }, {}));
    });
});

async function getRepoInfo({repo, user, password, continuationToken}) {
    const query = continuationToken ? `&continuationToken=${continuationToken}` : '';
    return request({
        method: 'get',
        json: true,
        url: `${repo}${query}`,
        'auth': {
            'user': user,
            'password': password,
        }
    }).then(({items, continuationToken}) => {
        return {
            items: items.map(({name}) => name),
            continuationToken,
        }
    });
}

async function generateExistAssetsMap({repo, user, password}) {
    const assetsMap = [];
    const firsRes = await getRepoInfo({repo, user, password});
    assetsMap.push(...firsRes.items);
    let continuationToken = firsRes.continuationToken;
    while (true) {
        if(!continuationToken) {
            return assetsMap;
        }
        const res = await getRepoInfo({repo, user, password, continuationToken});
        assetsMap.push(...res.items);
        continuationToken = res.continuationToken;
    }
}

async function uploadAssetsToNexus({assetsPath, repo, user, password}) {

    const existsAssetsMap = await generateExistAssetsMap({repo, user, password});
    const skipUpload = [];
    const assets = await getNewAssets(path.resolve(assetsPath), existsAssetsMap, skipUpload);
    if(Object.keys(assets).length === 0) {
        return {ok: true};
    }
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
}


uploadAssetsToNexus({
    assetsPath: './dist',
    repo: repo,
    user: user,
    password: password
})
    .then((r) => {
        console.log(r)
    })
    .catch((e) => {
        console.log(e)
    });