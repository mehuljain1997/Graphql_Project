import 'reflect-metadata';
import { ensureDateFormat, validateArtifact } from '../../../resolvers/commons';

const VALID_DATE_FORMAT = '2019-07-03';
const INVALID_DATE_FORMAT = '2019-07:03';

const validArtifactDateInput: any = {
  artifact: {
    elements: [
      {
        artifactDate: VALID_DATE_FORMAT,
      },
      {
        artifactDate: VALID_DATE_FORMAT,
      },
    ],
  },
};

const invalidArtifactDateInput: any = {
  artifact: {
    elements: [
      {
        artifactDate: VALID_DATE_FORMAT,
      },
      {
        artifactDate: INVALID_DATE_FORMAT,
      },
    ],
  },
};

describe('Commons module ensureDateFormat', () => {
  it('should not throw error for valid date format', async() => {
    let valid: boolean = true;
    try {
      ensureDateFormat(VALID_DATE_FORMAT);
    } catch (err) {
      valid = false;
    }
    expect(valid).toBe(true);
  });

  it('should throw error for invalid date format', async() => {
    let invalid: boolean = false;
    try {
      ensureDateFormat(INVALID_DATE_FORMAT);
    } catch (error) {
      invalid = true;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe(`Invalid ISO artifactDate format : 2019-07:03`);
    }
    expect(invalid).toBe(true);
  });
});

describe('Commons module validateArtifact', () => {
  it('should not throw error for valid input artifactDate format', async() => {
    let valid: boolean = true;
    try {
      validateArtifact(validArtifactDateInput);
    } catch (err) {
      valid = false;
    }
    expect(valid).toBe(true);
  });

  it('should throw error for invalid input artifactDate format', async() => {
    let invalid: boolean = false;
    try {
      validateArtifact(invalidArtifactDateInput);
    } catch (error) {
      invalid = true;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe(`Invalid ISO artifactDate format : 2019-07:03`);
      expect(invalid).toBe(true);
    }
  });
});

 