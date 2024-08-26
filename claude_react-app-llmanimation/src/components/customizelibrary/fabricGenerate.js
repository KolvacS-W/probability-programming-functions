// fabricGenerate.js
// const ngrok_url_sonnet = 'YOUR_NGROK_URL_HERE';

class Generate {
    constructor(name) {
        this.basic_prompt = name;
        // this.shape_prompt = '';
        // this.color_prompt = '';
        this.detail_prompt = '';
        // this.full_prompt = '';
        console.log('object created:', name)
    }

    detail(detail) {
        this.detail_prompt = detail;
        // this.full_prompt = `${this.basic_prompt} ${this.shape_prompt} ${this.color_prompt} ${this.detail_prompt}`;
        console.log('detail added:', detail)
    }

    async draw(coord, canvas, ngrok_url) {
        const APIprompt = 'write me svg code to create a '+ this.basic + ', with these details: ' + this.detail_prompt + '. Make sure donot include anything other than the svg code in your response.'
        console.log('api prompt', APIprompt)
        try {
            const response = await axios.post(ngrok_url, {
                prompt: APIprompt
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            const data = response.data;
            const content = data?.content;
            console.log('content from api call:', content);

            if (content) {
                fabric.loadSVGFromString(content, (objects, options) => {
                    const group = fabric.util.groupSVGElements(objects, options);
                    group.set({
                        left: coord.x - group.width / 2,
                        top: coord.y - group.height / 2
                    });
                    canvas.add(group);
                    canvas.renderAll();
                });
            }
        } catch (error) {
            console.error('Error drawing the shape:', error);
        }
    }
}
