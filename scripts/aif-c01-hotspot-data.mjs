// Answer keys for the 32 AIF-C01 HOTSPOT sections, transcribed from the widget
// bitmaps embedded in the source PDFs.
//
// Why this table is data and not parsed text: on a HOTSPOT page the candidate
// list lives in an /Image XObject, not in the text layer (ordinary question
// pages carry no image at all). The dropdown contents — and therefore the
// distractors — cannot be recovered from `extract_text()`. Each of those images
// appears twice in the source: once blank and once with the official choice
// outlined in green. Both were read for every question, and the highlighted
// choice is what is recorded here.
//
// The write-up in the text layer was used as a cross-check, not as the source.
// It disagrees in two places and the bitmap wins both times:
//   * #144 — the write-up lists only three of the four rows (it drops
//     "Denied topics"); the widget shows four.
//   * #280, #291 — the write-up has no official-answer section at all; the
//     widget has the full key.
//
// `kind` is the record type to emit. For `matching`, `rows` is [use case,
// correct choice] in the order the widget lists them. For `ordering`, `rows` is
// the correct sequence and `pool` holds every candidate, including the ones that
// belong in no step.
export const HOTSPOT = {
  114: {
    kind: 'ordering',
    pool: ['Deploy model', 'Develop model', 'Monitor model', 'Define business goal and frame ML problem'],
    rows: ['Define business goal and frame ML problem', 'Develop model', 'Deploy model', 'Monitor model'],
  },
  125: {
    kind: 'matching',
    pool: ['Batch transform', 'Real-time inference'],
    rows: [
      ["The company's chatbot needs predictions from the LLM to understand users' intent with minimal latency.", 'Real-time inference'],
      ['A data processing job needs to query the LLM to process gigabytes of text files on weekends.', 'Batch transform'],
      ["The company's engineering team needs to create an API that can process small pieces of text content and provide low-latency predictions.", 'Real-time inference'],
    ],
  },
  135: {
    kind: 'matching',
    pool: ['Supervised learning', 'Unsupervised learning'],
    rows: [
      ['Binary classification', 'Supervised learning'],
      ['Multi-class classification', 'Supervised learning'],
      ['K-means clustering', 'Unsupervised learning'],
      ['Dimensionality reduction', 'Unsupervised learning'],
    ],
  },
  143: {
    kind: 'matching',
    pool: ['Chain-of-thought reasoning', 'Few-shot learning', 'Zero-shot learning'],
    rows: [
      ['"Classify the following text as either sports, politics, or entertainment: [input text]."', 'Zero-shot learning'],
      ['"A [image 1], [image 2], and [image 3] are examples of [target class]. Classify the following image as [target class]."', 'Few-shot learning'],
      ['"[Question.] [Instructions to follow.] Think step by step and walk me through your thinking."', 'Chain-of-thought reasoning'],
    ],
  },
  144: {
    kind: 'matching',
    pool: ['Content filters', 'Contextual grounding check', 'Denied topics', 'Word filters'],
    rows: [
      ['Block input prompts or model responses that contain harmful content such as hate, insults, violence, or misconduct', 'Content filters'],
      ['Avoid subjects related to illegal investment advice or legal advice', 'Denied topics'],
      ['Detect and block specific offensive terms', 'Word filters'],
      ["Detect and filter out information in the model's responses that is not grounded in the provided source information", 'Contextual grounding check'],
    ],
  },
  155: {
    kind: 'matching',
    pool: ['Continued pre-training', 'Data augmentation', 'Model fine-tuning'],
    rows: [
      ['The models must be taught a new domain-specific task', 'Model fine-tuning'],
      ['A limited amount of labeled data is available and more data is needed', 'Data augmentation'],
      ['Only unlabeled data is available', 'Continued pre-training'],
    ],
  },
  185: {
    kind: 'matching',
    pool: ['Continued pre-training', 'Fine-tuning'],
    rows: [
      ["The company wants to improve the model's performance on specific tasks and examples.", 'Fine-tuning'],
      ["The company wants to improve the model's domain knowledge by providing specific documents.", 'Continued pre-training'],
      ['The company wants to retrain the model by using more unlabeled data over time.', 'Continued pre-training'],
    ],
  },
  188: {
    kind: 'matching',
    pool: ['Governance', 'Privacy and security', 'Safety', 'Transparency'],
    rows: [
      ['Anonymize personal information during training data preparation', 'Privacy and security'],
      ['Design the customer service chatbot to provide explainable decisions', 'Transparency'],
      ['Use Amazon Bedrock Guardrails to prevent harmful output and misuse of the chatbot', 'Safety'],
    ],
  },
  191: {
    kind: 'matching',
    pool: ['SageMaker Canvas', 'SageMaker Feature Store', 'SageMaker Ground Truth', 'SageMaker JumpStart', 'SageMaker Model Monitor'],
    rows: [
      ['Preparing data through a visual interface without using code', 'SageMaker Canvas'],
      ['Finding and using a prebuilt solution for fraud detection', 'SageMaker JumpStart'],
      ['Create labeled datasets with human intervention', 'SageMaker Ground Truth'],
    ],
  },
  229: {
    kind: 'matching',
    pool: ['SageMaker Clarify', 'SageMaker Model Registry', 'SageMaker Serverless Inference'],
    rows: [
      ['Managing different versions of the model', 'SageMaker Model Registry'],
      ['Using the current model to make predictions', 'SageMaker Serverless Inference'],
    ],
  },
  235: {
    kind: 'matching',
    pool: ['Diffusion model', 'Object detection model', 'Transformer-based model'],
    rows: [
      ['Create high-quality images that are influenced by the generated slogans and product', 'Diffusion model'],
      ['Create contextually relevant slogans based on the advertisement product', 'Transformer-based model'],
      ['Ensure that company brand elements are properly placed in the images', 'Object detection model'],
    ],
  },
  245: {
    kind: 'matching',
    pool: ['Explainability', 'Fairness', 'Privacy and security', 'Robustness', 'Safety'],
    rows: [
      ['Encrypt the application data, and isolate the application on a private network.', 'Privacy and security'],
      ['Evaluate how different population groups will be impacted.', 'Fairness'],
      ['Test the application with unexpected data to ensure the application will work in unique situations.', 'Robustness'],
    ],
  },
  257: {
    kind: 'matching',
    pool: ['Amazon SageMaker Clarify', 'Amazon SageMaker Ground Truth', 'Amazon Bedrock Guardrails', 'AWS CloudTrail', 'AWS Trusted Advisor'],
    rows: [
      ['Apply human feedback across the ML lifecycle to improve the accuracy and relevancy of models.', 'Amazon SageMaker Ground Truth'],
      ['Implement safeguards that align with responsible AI policies.', 'Amazon Bedrock Guardrails'],
      ['Detect potential bias during data preparation and model training.', 'Amazon SageMaker Clarify'],
    ],
  },
  264: {
    kind: 'matching',
    pool: ['Binary classification', 'Multiclass classification', 'Regression'],
    rows: [
      ['Analyze a text question to determine if the answer is correct.', 'Binary classification'],
      ['Analyze ecological factors to determine the number of species in a certain area.', 'Regression'],
      ['Analyze car attributes to determine the car model.', 'Multiclass classification'],
    ],
  },
  267: {
    kind: 'matching',
    pool: ['Clarify', 'Data Wrangler', 'Model Cards'],
    rows: [
      ['Determine the most suitable model to use for a business case.', 'Model Cards'],
      ['Prepare data through a low-code or no-code interface.', 'Data Wrangler'],
      ['Identify biases or imbalances in the data.', 'Clarify'],
    ],
  },
  275: {
    kind: 'matching',
    pool: ['Average order value (AOV)', 'Click-through rate (CTR)', 'Retention rate'],
    rows: [
      ['Measure how engaging the product recommendations are to users', 'Click-through rate (CTR)'],
      ['Determine the effect of the AI solution on the total value of user purchases', 'Average order value (AOV)'],
      ["Assess the AI solution's ability to encourage users to return to the platform", 'Retention rate'],
    ],
  },
  280: {
    kind: 'matching',
    pool: ['Few-shot learning', 'Fine-tuning', 'Retrieval Augmented Generation (RAG)', 'Zero-shot learning'],
    rows: [
      ['Enhancing the capabilities of a large language model (LLM) by using external sources', 'Retrieval Augmented Generation (RAG)'],
      ['Querying a model to generalize and make predictions on unseen tasks', 'Zero-shot learning'],
      ['Querying a model with a limited amount of data for new tasks', 'Few-shot learning'],
    ],
  },
  283: {
    kind: 'matching',
    pool: ['AI', 'Deep learning', 'ML'],
    rows: [
      ['Simulates human problem-solving capabilities', 'AI'],
      ['Applies data-driven learning techniques to make predictions', 'ML'],
      ['Focuses on processing data through intricate neural networks', 'Deep learning'],
    ],
  },
  291: {
    kind: 'matching',
    pool: ['Image data', 'Tabular data', 'Text data', 'Time series data'],
    rows: [
      ['Build a sentiment analysis model for social media posts.', 'Text data'],
      ['Train a self-driving car to recognize traffic signs.', 'Image data'],
      ['Optimize ad campaigns by using customer demographic data and purchase history.', 'Tabular data'],
      ['Forecast stock prices by using historical price data.', 'Time series data'],
    ],
  },
  300: {
    kind: 'matching',
    pool: ['Concurrency', 'Context windows', 'Latency'],
    rows: [
      ['Amount of information that can fit in a single prompt', 'Context windows'],
      ['Length of time it takes for a model to generate an output', 'Latency'],
      ['Multiple users invoking an application endpoint simultaneously', 'Concurrency'],
    ],
  },
  309: {
    kind: 'ordering',
    pool: ['Define the business objective.', 'Deploy the model.', 'Develop and train the model.', 'Process the data.'],
    rows: ['Define the business objective.', 'Process the data.', 'Develop and train the model.', 'Deploy the model.'],
  },
  311: {
    kind: 'matching',
    pool: ['Chain-of-thought prompting', 'Few-shot prompting', 'Role-based prompting', 'Single-shot prompting', 'Zero-shot prompting'],
    rows: [
      ['Provide a small number of examples to the model to understand the desired task before generating outputs.', 'Few-shot prompting'],
      ['Prompt a model to break down the step-by-step process that the model took to arrive at a final answer.', 'Chain-of-thought prompting'],
      ['Prompt a model to perform a task without providing examples.', 'Zero-shot prompting'],
    ],
  },
  313: {
    kind: 'ordering',
    pool: [
      'Insert data into the product database.',
      'Upload the digital text and image files to an Amazon S3 bucket.',
      'Use Amazon Nova multimodal models to process the digital text and image files.',
    ],
    rows: [
      'Upload the digital text and image files to an Amazon S3 bucket.',
      'Use Amazon Nova multimodal models to process the digital text and image files.',
      'Insert data into the product database.',
    ],
  },
  328: {
    kind: 'ordering',
    pool: ['Continued pre-training', 'Fine-tuning', 'Prompt engineering', 'Retrieval Augmented Generation (RAG)'],
    rows: ['Prompt engineering', 'Retrieval Augmented Generation (RAG)', 'Fine-tuning', 'Continued pre-training'],
  },
  350: {
    kind: 'matching',
    pool: ['Classification', 'Clustering', 'Regression'],
    rows: [
      ["Predict customer lifetime value (CLV) by estimating how much revenue a customer will generate over the customer's lifetime.", 'Regression'],
      ["Identify the likelihood of a customer to stop using the company's services.", 'Classification'],
      ['Group customers based on similar purchasing patterns and preferences.', 'Clustering'],
    ],
  },
  351: {
    kind: 'ordering',
    pool: ['Deploy the model.', 'Prepare the data for training.', 'Test the model.', 'Train the model.'],
    rows: ['Prepare the data for training.', 'Train the model.', 'Test the model.', 'Deploy the model.'],
  },
  366: {
    kind: 'matching',
    pool: ['Continued pre-training', 'Distillation', 'Fine-tuning'],
    rows: [
      ['Provide labeled data to customize a model to improve performance on specific tasks.', 'Fine-tuning'],
      ['Provide unlabeled data to customize an FM for a specific domain.', 'Continued pre-training'],
      ['Transfer knowledge from a larger and more intelligent model to a smaller model.', 'Distillation'],
    ],
  },
  387: {
    kind: 'ordering',
    pool: [
      'Determine governance goals, risks, and policies.',
      'Put together a cross-functional AI governance group.',
      'Set up model monitoring mechanisms.',
    ],
    rows: [
      'Determine governance goals, risks, and policies.',
      'Put together a cross-functional AI governance group.',
      'Set up model monitoring mechanisms.',
    ],
  },
  403: {
    kind: 'matching',
    pool: ['Computer vision', 'Natural language processing (NLP)', 'Reinforcement learning', 'Time series forecasting'],
    rows: [
      ['A dataset that contains text-based customer reviews', 'Natural language processing (NLP)'],
      ['A dataset that contains images of animals labeled with their species names', 'Computer vision'],
      ['A dataset that contains daily sales volumes for products', 'Time series forecasting'],
    ],
  },
  417: {
    kind: 'matching',
    pool: ['Response style', 'Role', 'Success criteria', 'Task'],
    rows: [
      ['Specify the use case for the model.', 'Task'],
      ['Define the persona the model should assume to meet the requirements effectively.', 'Role'],
      ['Describe the tone, format, or structure that the model should follow.', 'Response style'],
      ['Set clear metrics to evaluate whether the model output meets expectations.', 'Success criteria'],
    ],
  },
  442: {
    kind: 'matching',
    pool: ['Observability', 'Code Interpreter', 'Browser tool', 'Runtime', 'Gateway', 'Memory'],
    rows: [
      ['Monitor agent behavior through intuitive dashboards', 'Observability'],
      ['Execute code securely across multiple languages', 'Code Interpreter'],
      ['Fast, secure, and serverless browser runtime for agents', 'Browser tool'],
    ],
  },
  443: {
    kind: 'ordering',
    pool: [
      'Convert the chunks into vector embeddings.',
      'Divide the data into chunks.',
      'Parse the documents.',
      'Use data events to create a data lineage.',
      'Use Retrieval Augmented Generation (RAG) to retrieve relevant content.',
      'Write the vector embeddings to the vector store.',
    ],
    rows: [
      'Parse the documents.',
      'Divide the data into chunks.',
      'Convert the chunks into vector embeddings.',
      'Write the vector embeddings to the vector store.',
    ],
  },
}
